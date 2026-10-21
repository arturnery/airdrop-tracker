"use client";

import { useId, useSyncExternalStore } from "react";
import { ChartLine } from "lucide-react";

import { EmptyState, PageHeader } from "@/components/page-header";
import { CardSinal } from "@/components/views/sinais-view";
import { cents, formatUsd, parseUserInput } from "@/lib/money";
import {
  meuPlacar,
  formatarPercentual,
  formatarR,
  placarDosSinais,
  totalEmDolar,
  type Sinal,
  type SimulacaoDolar,
} from "@/lib/sinais";
import { cn } from "@/lib/utils";

/**
 * Sinais fechados: o placar no topo e os cards embaixo, do fechamento mais
 * recente ao mais antigo. O placar soma o mesmo resultado que cada card
 * mostra (`placarDosSinais`), e os não acionados aparecem na lista mas não
 * contam: um sinal que nunca entrou não acertou nem errou.
 *
 * Em dólar, só se a pessoa quiser: ela informa quanto usa por operação e os
 * valores aparecem no placar e em cada card. Guardado no navegador dela,
 * como a escolha dos grupos do menu: é preferência de tela, não dado.
 */
export function ResultadosView({ sinais, ehAdmin }: { sinais: Sinal[]; ehAdmin: boolean }) {
  const placar = placarDosSinais(sinais);
  const [bruto, modo, simulacao] = useSimulacao();
  const totalDolar = simulacao ? totalEmDolar(sinais, simulacao) : null;
  const meu = meuPlacar(sinais);
  const tom = (valor: number) => (valor > 0 ? "text-positive" : valor < 0 ? "text-negative" : undefined);

  return (
    <>
      <PageHeader
        icon={ChartLine}
        title="Resultados"
        description="Operações fechadas e o placar: quantos deram lucro, quantos deram prejuízo e quanto somaram."
      />

      {sinais.length === 0 ? (
        <EmptyState
          title="Nenhuma operação fechada ainda."
          description="Quando uma operação for fechada em Operações, ela aparece aqui com o resultado."
        />
      ) : (
        <>
          {meu ? (
            <div className="bg-card border-border mb-3 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 rounded-lg border px-4 py-3">
              <span className="text-sm font-medium">Seu resultado nas operações em que entrou</span>
              <span className="text-muted-foreground text-xs">
                {meu.operacoes} {meu.operacoes === 1 ? "operação" : "operações"}, com{" "}
                {formatUsd(cents(Math.round(meu.totalEntrado * 100)))} de entrada
              </span>
              <span className={cn("text-2xl font-semibold tabular-nums", tom(meu.resultadoUsd))}>
                {formatUsd(cents(Math.round(meu.resultadoUsd * 100)), { signDisplay: "exceptZero" })}
              </span>
            </div>
          ) : null}

          <SimularEmDolar bruto={bruto} modo={modo} />

          <dl
            className={cn(
              "mb-6 grid grid-cols-2 gap-3 tabular-nums",
              totalDolar === null ? "sm:grid-cols-4" : "sm:grid-cols-3 lg:grid-cols-5",
            )}
          >
            <Numero rotulo="Fechados" valor={String(placar.fechados)} />
            <Numero
              rotulo="Taxa de acerto"
              valor={
                placar.taxaDeAcerto === null
                  ? "–"
                  : `${placar.taxaDeAcerto.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}%`
              }
              detalhe={`${placar.lucros} com lucro · ${placar.prejuizos} com prejuízo`}
            />
            <Numero
              rotulo="Soma em R"
              valor={formatarR(placar.somaR)}
              classe={tom(placar.somaR)}
              detalhe="Riscos ganhos menos perdidos"
            />
            <Numero
              rotulo="Soma em %"
              valor={formatarPercentual(placar.somaPercentual)}
              classe={tom(placar.somaPercentual)}
              detalhe="Variação somada, sem alavancagem"
            />
            {totalDolar !== null && simulacao ? (
              <Numero
                rotulo="Em dólar (simulado)"
                valor={formatUsd(cents(Math.round(totalDolar * 100)), { signDisplay: "exceptZero" })}
                classe={tom(totalDolar)}
                detalhe={
                  simulacao.modo === "risco"
                    ? `Arriscando ${formatUsd(cents(Math.round(simulacao.valor * 100)))} por operação`
                    : `Posição de ${formatUsd(cents(Math.round(simulacao.valor * 100)))} por operação`
                }
              />
            ) : null}
          </dl>

          <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {sinais.map((sinal) => (
              <li key={sinal.id}>
                <CardSinal sinal={sinal} ehAdmin={ehAdmin} discordConfigurado={false} simulacao={simulacao} />
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}

/*
 * Valor e modo guardados como texto no navegador. O valor fica como foi
 * digitado ("1.000"), para o campo mostrar exatamente o que a pessoa
 * escreveu; a leitura em número é feita a cada render, pelo mesmo leitor de
 * dinheiro do resto do site (onde "1.000" é mil).
 */
const CHAVE_VALOR = "trade-simulacao-valor";
const CHAVE_MODO = "trade-simulacao-modo";
const EVENTO = "trade-simulacao-mudou";

function ler(chave: string): string {
  try {
    return localStorage.getItem(chave) ?? "";
  } catch {
    return "";
  }
}

function gravar(chave: string, valor: string) {
  try {
    localStorage.setItem(chave, valor);
  } catch {
    // Sem armazenamento, a simulação vale só até recarregar.
  }
  window.dispatchEvent(new Event(EVENTO));
}

function assinar(avisar: () => void) {
  window.addEventListener(EVENTO, avisar);
  window.addEventListener("storage", avisar);
  return () => {
    window.removeEventListener(EVENTO, avisar);
    window.removeEventListener("storage", avisar);
  };
}

function useSimulacao(): [string, SimulacaoDolar["modo"], SimulacaoDolar | null] {
  const bruto = useSyncExternalStore(assinar, () => ler(CHAVE_VALOR), () => "");
  const modo: SimulacaoDolar["modo"] =
    useSyncExternalStore(assinar, () => ler(CHAVE_MODO), () => "") === "posicao" ? "posicao" : "risco";
  const lido = bruto.trim() ? parseUserInput(bruto) : null;
  const simulacao = lido?.ok && lido.value > 0 ? { modo, valor: lido.value / 100 } : null;
  return [bruto, modo, simulacao];
}

function SimularEmDolar({ bruto, modo }: { bruto: string; modo: SimulacaoDolar["modo"] }) {
  const id = useId();
  const invalido = bruto.trim() !== "" && !(parseUserInput(bruto).ok);
  return (
    <div className="bg-card border-border mb-3 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border px-4 py-3 text-sm">
      <span className="font-medium">Ver em dólar</span>
      <select
        aria-label="Como simular"
        value={modo}
        onChange={(e) => gravar(CHAVE_MODO, e.target.value)}
        className="border-input bg-transparent h-8 rounded-md border px-2 text-sm [&>option]:bg-popover"
      >
        <option value="risco">arriscando por operação</option>
        <option value="posicao">com posição de</option>
      </select>
      <label htmlFor={id} className="sr-only">
        Valor em dólar por operação
      </label>
      <div className="flex items-center gap-1">
        <span className="text-muted-foreground">US$</span>
        <input
          id={id}
          value={bruto}
          onChange={(e) => gravar(CHAVE_VALOR, e.target.value)}
          inputMode="decimal"
          autoComplete="off"
          placeholder="100"
          aria-invalid={invalido || undefined}
          className="border-input bg-transparent h-8 w-28 rounded-md border px-2 text-sm tabular-nums aria-invalid:border-destructive"
        />
      </div>
      <span className="text-muted-foreground text-xs">
        {invalido
          ? "Valor inválido."
          : modo === "risco"
            ? "Quanto você perderia no stop. Cada R vale esse valor."
            : "Tamanho da posição, sem alavancagem."}{" "}
        Fica salvo só neste navegador; deixe vazio para esconder.
      </span>
    </div>
  );
}

function Numero({
  rotulo,
  valor,
  detalhe,
  classe,
}: {
  rotulo: string;
  valor: string;
  detalhe?: string;
  classe?: string;
}) {
  return (
    <div className="bg-card border-border rounded-lg border p-4">
      <dt className="text-muted-foreground text-xs">{rotulo}</dt>
      <dd className={cn("mt-1 text-2xl font-semibold tracking-tight", classe)}>{valor}</dd>
      {detalhe ? <dd className="text-muted-foreground mt-0.5 text-xs">{detalhe}</dd> : null}
    </div>
  );
}
