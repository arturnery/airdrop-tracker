"use client";

import { useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { formatDateBr, isoParaData, subtrairMeses } from "@/lib/dates";
import { cents, formatUsd, formatUsdCompact } from "@/lib/money";
import type { PontoResultado } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * Ponto pronto para o eixo numérico do recharts: `x` é o timestamp, os
 * demais campos são os mesmos de `PontoResultado`, mais `dataIso` para o
 * tooltip (o eixo perde a string original ao virar número).
 */
type PontoDoGrafico = {
  x: number;
  dataIso: string;
  resultado: number;
  airdrops: PontoResultado["airdrops"];
};

const JANELAS = [
  { valor: "1m", rotulo: "1M", meses: 1 },
  { valor: "3m", rotulo: "3M", meses: 3 },
  { valor: "6m", rotulo: "6M", meses: 6 },
  { valor: "tudo", rotulo: "Tudo", meses: null },
] as const;

type Janela = (typeof JANELAS)[number]["valor"];

/**
 * Recorta a série para a janela pedida, sem re-basear o valor a zero.
 *
 * O corte é sobre o resultado ACUMULADO, então o primeiro ponto visível
 * precisa carregar o valor que já existia antes do corte, não recomeçar do
 * zero: senão "último mês" pareceria um projeto novo toda vez que a pessoa
 * trocasse de aba.
 */
function recortarJanela(pontos: PontoResultado[], janela: Janela): PontoResultado[] {
  const definicao = JANELAS.find((j) => j.valor === janela)!;
  if (definicao.meses === null || pontos.length === 0) return pontos;

  const referencia = pontos.at(-1)!.data;
  const corte = subtrairMeses(referencia, definicao.meses);

  const antes = pontos.filter((p) => p.data < corte);
  const depois = pontos.filter((p) => p.data >= corte);
  const carregado = antes.at(-1);

  if (!carregado) return depois;
  return [{ data: corte, resultado: carregado.resultado, airdrops: [] }, ...depois];
}

/**
 * Evolução do resultado, em área com gradiente e recorte por período.
 *
 * Pedido do Artur com uma referência visual (gráfico de portfólio do
 * CoinGecko): área preenchida, abas de período e eixo por tempo real, não
 * por evento. Adaptado ao que os dados deste app realmente têm: farmar
 * airdrop não gera evento todo dia, então "24h" e "7d" do original viram
 * quase sempre uma linha vazia aqui. Ficaram 1M/3M/6M/Tudo, que são os
 * recortes que fazem uma janela ter cara diferente da outra com lançamento
 * esparso.
 *
 * Só existe ponto no dia em que um airdrop é lançado (ver a decisão em
 * `selectEvolucaoDoResultado`): trade e rendimento de um projeto ficam
 * pendentes e entram junto quando o airdrop dele chega, líquidos. Por isso
 * todo ponto tem pelo menos um airdrop, e a linha não tem degrau isolado de
 * um trade perdedor sem contexto.
 *
 * Única biblioteca de gráfico do projeto: o resto da interface desenha com
 * CSS puro (ver `components/capital-chart.tsx`), mas a área com gradiente,
 * eixo de tempo e abas custaria bem mais para replicar à mão do que uma
 * barra. O recharts já estava instalado, sem uso.
 */
export function ResultadoChart({ pontos }: { pontos: PontoResultado[] }) {
  const [janela, setJanela] = useState<Janela>("tudo");

  if (pontos.length === 0) {
    return (
      <div className="border-border rounded-lg border border-dashed px-6 py-10 text-center">
        <p className="text-sm font-medium">Nada para mostrar ainda.</p>
        <p className="text-muted-foreground mt-1 text-sm">
          A linha aparece quando você registrar o primeiro airdrop recebido.
        </p>
      </div>
    );
  }

  // A cor segue o resultado final de verdade, não o da janela: trocar de aba
  // muda o que se vê, não o que o cartão "Resultado" ao lado já diz.
  const final = pontos.at(-1)!.resultado;
  const corLinha = final >= 0 ? "var(--positive)" : "var(--negative)";

  const recortados = recortarJanela(pontos, janela);
  const dados: PontoDoGrafico[] = recortados.map((p) => ({
    x: isoParaData(p.data).getTime(),
    dataIso: p.data,
    resultado: p.resultado,
    airdrops: p.airdrops,
  }));
  const ticksDeMes = ticksPorMes(dados);

  return (
    <div className="border-border rounded-lg border p-5">
      <div className="mb-4 flex justify-end">
        <div className="bg-secondary/40 inline-flex items-center gap-0.5 rounded-md p-0.5">
          {JANELAS.map((j) => (
            <button
              key={j.valor}
              type="button"
              onClick={() => setJanela(j.valor)}
              className={cn(
                "rounded-sm px-2.5 py-1 text-xs font-medium transition-colors",
                j.valor === janela
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
              aria-pressed={j.valor === janela}
            >
              {j.rotulo}
            </button>
          ))}
        </div>
      </div>

      <div style={{ width: "100%", height: 260 }}>
        <ResponsiveContainer>
          <AreaChart data={dados} margin={{ top: 8, right: 12, left: 12, bottom: 0 }}>
            <defs>
              <linearGradient id="preenchimentoResultado" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={corLinha} stopOpacity={0.35} />
                <stop offset="95%" stopColor={corLinha} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="var(--border)" vertical={false} />
            <ReferenceLine y={0} stroke="var(--border)" strokeDasharray="3 3" />
            <XAxis
              dataKey="x"
              type="number"
              scale="time"
              domain={["dataMin", "dataMax"]}
              ticks={ticksDeMes}
              tickFormatter={(v: number) => formatMesCurto(v)}
              stroke="var(--muted-foreground)"
              fontSize={12}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              tickFormatter={(v: number) => formatUsdCompact(cents(v))}
              stroke="var(--muted-foreground)"
              fontSize={12}
              tickLine={false}
              axisLine={false}
              width={64}
            />
            <Tooltip content={<TooltipResultado />} />
            <Area
              type="stepAfter"
              dataKey="resultado"
              stroke={corLinha}
              strokeWidth={2}
              fill="url(#preenchimentoResultado)"
              dot={<PontoDoGrafico />}
              activeDot={{ r: 4 }}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/**
 * Um tick por mês do calendário, não um por ponto de dado.
 *
 * O eixo é de tempo real, então dois lançamentos no mesmo mês geram dois
 * pontos próximos, e o auto-tick do recharts não sabe que os rótulos dele
 * ficariam repetidos ("jul/26", "jul/26"). Aqui o mês é que manda: um tick no
 * dia 1 de cada mês entre o primeiro e o último ponto, cheio ou vazio.
 */
function ticksPorMes(dados: PontoDoGrafico[]): number[] {
  if (dados.length === 0) return [];
  const max = dados.at(-1)!.x;
  const cursor = new Date(dados[0]!.x);
  cursor.setUTCDate(1);
  cursor.setUTCHours(12, 0, 0, 0);

  const ticks: number[] = [];
  while (cursor.getTime() <= max) {
    ticks.push(cursor.getTime());
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  return ticks;
}

function formatMesCurto(timestamp: number): string {
  const data = new Date(timestamp);
  // UTC explícito: os pontos vêm de `isoParaData` (meio-dia UTC), e o fuso do
  // navegador não pode empurrar a data para o mês vizinho no rótulo.
  const mes = new Intl.DateTimeFormat("pt-BR", { month: "short", timeZone: "UTC" })
    .format(data)
    .replace(".", "");
  const ano = String(data.getUTCFullYear()).slice(-2);
  return `${mes}/${ano}`;
}

/**
 * Todo ponto da série tem pelo menos um airdrop (é o que gera o ponto, ver
 * `selectEvolucaoDoResultado`), então na prática todo ponto ganha marcador.
 * A checagem fica aqui mesmo assim, e não com `dot={true}`, porque o formato
 * (círculo âmbar com anel) é o mesmo que o resto do sistema usa para chamar
 * atenção, e um `dot` genérico do recharts não teria esse desenho.
 *
 * Âmbar, não verde: o marcador é um "olhe aqui", e verde sumia dentro da
 * própria linha sempre que o resultado estava positivo (a cor mais comum).
 * Âmbar contrasta com a linha verde e com a vermelha, e reaproveita a cor de
 * "isso merece atenção" que o sistema já usa em prioridade e avisos, sem
 * tocar no azul, que é só de marca (ARCHITECTURE §14.8).
 */
function PontoDoGrafico(props: { cx?: number; cy?: number; payload?: PontoDoGrafico }) {
  const { cx, cy, payload } = props;
  if (!payload?.airdrops?.length || cx === undefined || cy === undefined) {
    return <></>;
  }
  return (
    <circle
      cx={cx}
      cy={cy}
      r={5}
      fill="var(--caution)"
      stroke="var(--card)"
      strokeWidth={2}
    />
  );
}

function TooltipResultado({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload: PontoDoGrafico }[];
}) {
  if (!active || !payload?.length) return null;
  const ponto = payload[0]!.payload;

  return (
    <div className="bg-popover border-border rounded-md border px-3 py-2 text-xs shadow-md">
      <p className="text-muted-foreground">{formatDateBr(ponto.dataIso)}</p>
      <p className="font-numeric mt-1 font-semibold">{formatUsd(cents(ponto.resultado))}</p>
      {ponto.airdrops.map((a, i) => (
        <div key={i} className="mt-1">
          <p className="text-positive font-medium">
            Airdrop de {a.projeto}: +{formatUsd(a.valor)}
          </p>
          {a.liquido !== a.valor ? (
            <p className={cn("font-medium", a.liquido >= 0 ? "text-positive" : "text-negative")}>
              Líquido com trade/rendimento pendente: {formatUsd(a.liquido, { signDisplay: "always" })}
            </p>
          ) : null}
        </div>
      ))}
    </div>
  );
}
