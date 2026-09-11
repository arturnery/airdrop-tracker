"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { formatDateBr, formatDateShort } from "@/lib/dates";
import { cents, formatUsd, formatUsdCompact } from "@/lib/money";
import type { PontoResultado } from "@/lib/types";

/**
 * Evolução do resultado, com um ponto maior em cada airdrop recebido.
 *
 * Eixo X por evento, não por tempo real decorrido: os pontos vêm de
 * lançamentos esparsos (um trade aqui, um airdrop dali a dois meses), e
 * espaçar por data de verdade deixaria a maior parte da linha vazia entre
 * dois eventos raros. A troca é aceita porque o eixo mostra a data de cada
 * ponto, e o tooltip sempre diz a data por extenso: a ordem cronológica não
 * se perde, só a proporção do intervalo entre eventos.
 *
 * Única biblioteca de gráfico do projeto: o resto da interface desenha com
 * CSS puro (ver `components/capital-chart.tsx`), mas uma linha com pontos de
 * destaque e tooltip por cima de dado esparso custaria bem mais para replicar
 * à mão do que uma barra. O recharts já estava instalado, sem uso.
 */
export function ResultadoChart({ pontos }: { pontos: PontoResultado[] }) {
  if (pontos.length === 0) {
    return (
      <div className="border-border rounded-lg border border-dashed px-6 py-10 text-center">
        <p className="text-sm font-medium">Nada para mostrar ainda.</p>
        <p className="text-muted-foreground mt-1 text-sm">
          A linha aparece assim que houver rendimento, taxa, resultado de trade
          ou airdrop recebido.
        </p>
      </div>
    );
  }

  const final = pontos.at(-1)!.resultado;
  const corLinha = final >= 0 ? "var(--positive)" : "var(--negative)";

  return (
    <div className="border-border rounded-lg border p-5">
      <div style={{ width: "100%", height: 260 }}>
        <ResponsiveContainer>
          <LineChart data={pontos} margin={{ top: 8, right: 12, left: 12, bottom: 0 }}>
            <CartesianGrid stroke="var(--border)" vertical={false} />
            <ReferenceLine y={0} stroke="var(--border)" strokeDasharray="3 3" />
            <XAxis
              dataKey="data"
              allowDuplicatedCategory={false}
              tickFormatter={(v: string) => formatDateShort(v)}
              stroke="var(--muted-foreground)"
              fontSize={12}
              tickLine={false}
              axisLine={false}
              minTickGap={24}
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
            <Line
              type="stepAfter"
              dataKey="resultado"
              stroke={corLinha}
              strokeWidth={2}
              dot={<PontoDoGrafico />}
              activeDot={{ r: 4 }}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/**
 * Só o airdrop ganha um marcador visível. Os demais pontos (trade, rendimento,
 * taxa) formam a linha sozinhos: marcá-los todos poluiria o traço sem
 * acrescentar o que o tooltip já responde ao passar o mouse.
 */
function PontoDoGrafico(props: {
  cx?: number;
  cy?: number;
  payload?: PontoResultado;
}) {
  const { cx, cy, payload } = props;
  if (!payload?.airdrop || cx === undefined || cy === undefined) {
    return <></>;
  }
  return (
    <circle
      cx={cx}
      cy={cy}
      r={5}
      fill="var(--positive)"
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
  payload?: { payload: PontoResultado }[];
}) {
  if (!active || !payload?.length) return null;
  const ponto = payload[0]!.payload;

  return (
    <div className="bg-popover border-border rounded-md border px-3 py-2 text-xs shadow-md">
      <p className="text-muted-foreground">{formatDateBr(ponto.data)}</p>
      <p className="font-numeric mt-1 font-semibold">{formatUsd(ponto.resultado)}</p>
      {ponto.airdrop ? (
        <p className="text-positive mt-1 font-medium">
          Airdrop de {ponto.airdrop.projeto}: +{formatUsd(ponto.airdrop.valor)}
        </p>
      ) : null}
    </div>
  );
}
