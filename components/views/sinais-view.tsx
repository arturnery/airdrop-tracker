"use client";

import { useState } from "react";
import { ArrowDownRight, ArrowUpRight, ChartCandlestick, RotateCcw, Send } from "lucide-react";

import { BotaoLixeira, ConfirmarExclusao } from "@/components/forms/confirmar-exclusao";
import { FecharSinal } from "@/components/forms/fechar-sinal";
import { NovoSinal } from "@/components/forms/sinal";
import { SinalPorPrint } from "@/components/forms/sinal-por-print";
import { useDados } from "@/components/data-provider";
import { EmptyState, PageHeader } from "@/components/page-header";
import { formatarQuando } from "@/lib/lives";
import {
  formatarPercentual,
  formatarPreco,
  formatarR,
  resultadoDoSinal,
  riscoRetorno,
  resultadoEmDolar,
  rotuloSaida,
  type Sinal,
  type SimulacaoDolar,
} from "@/lib/sinais";
import { cents, formatUsd } from "@/lib/money";
import { cn } from "@/lib/utils";

const ROTULO_STATUS: Record<Sinal["status"], string> = {
  aberto: "Aberto",
  encerrado: "Fechado",
  cancelado: "Não acionado",
};

/**
 * Sinais de trade abertos, um card por operação, do mais recente ao mais
 * antigo. Os fechados vão para Resultados (`resultados-view`).
 *
 * A direção vai em selo neutro, com seta, e não em verde e vermelho: aqui
 * essas duas cores são de lucro e prejuízo (ARCHITECTURE §14.8), e marcam o
 * resultado do sinal fechado. Um sinal de venda em vermelho pareceria
 * prejuízo antes de existir resultado.
 */
export function SinaisView({
  sinais,
  ehAdmin,
  discordConfigurado = false,
}: {
  sinais: Sinal[];
  ehAdmin: boolean;
  /** Só com o webhook configurado faz sentido avisar de envio que não saiu. */
  discordConfigurado?: boolean;
}) {
  return (
    <>
      <PageHeader
        icon={ChartCandlestick}
        title="Sinais"
        description="Operações em aberto na área de trade: entrada, stop e alvos de cada uma. As fechadas ficam em Resultados."
        actions={
          ehAdmin ? (
            <>
              <SinalPorPrint />
              <NovoSinal />
            </>
          ) : null
        }
      />

      {sinais.length === 0 ? (
        <EmptyState
          title="Nenhum sinal aberto."
          description={
            ehAdmin
              ? "Publique o primeiro em Novo sinal."
              : "Quando uma operação for publicada, ela aparece aqui."
          }
        />
      ) : (
        <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {sinais.map((sinal) => (
            <li key={sinal.id}>
              <CardSinal sinal={sinal} ehAdmin={ehAdmin} discordConfigurado={discordConfigurado} />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

export function CardSinal({
  sinal,
  ehAdmin,
  discordConfigurado,
  simulacao = null,
}: {
  sinal: Sinal;
  ehAdmin: boolean;
  discordConfigurado: boolean;
  /** Na aba de resultados, quando a pessoa pediu para ver em dólar. */
  simulacao?: SimulacaoDolar | null;
}) {
  const { acoes } = useDados();
  const [reenviando, setReenviando] = useState(false);
  const [erroDiscord, setErroDiscord] = useState<string | null>(null);
  const compra = sinal.direcao === "compra";
  const Seta = compra ? ArrowUpRight : ArrowDownRight;

  return (
    <article className="bg-card border-border flex h-full flex-col rounded-lg border p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-lg leading-tight font-semibold tracking-tight">{sinal.ativo}</h3>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
            <span className="border-border inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-medium">
              <Seta className="size-3.5" aria-hidden="true" />
              {compra ? "Compra" : "Venda"}
            </span>
            {sinal.timeframe ? (
              <span className="text-muted-foreground border-border rounded-full border px-2 py-0.5">
                {sinal.timeframe}
              </span>
            ) : null}
            <span className="text-muted-foreground">{ROTULO_STATUS[sinal.status]}</span>
          </div>
        </div>
        {ehAdmin ? (
          <div className="flex shrink-0 items-center gap-1">
            {sinal.status === "aberto" ? (
              <FecharSinal sinal={sinal} />
            ) : (
              <button
                type="button"
                onClick={() => acoes.reabrirSinal(sinal.id)}
                className="text-muted-foreground hover:text-foreground hover:bg-accent focus-visible:ring-ring inline-flex h-7 items-center gap-1 rounded-md px-2 text-xs transition-colors focus-visible:ring-2 focus-visible:outline-none"
                title="Desfaz o fechamento: o sinal volta para a lista de abertos"
              >
                <RotateCcw className="size-3.5" aria-hidden="true" />
                Reabrir
              </button>
            )}
            <ConfirmarExclusao
              titulo="Excluir sinal"
              alvo={`${compra ? "Compra" : "Venda"} de ${sinal.ativo}`}
              aoConfirmar={() => acoes.excluirSinal(sinal.id)}
              gatilho={<BotaoLixeira rotulo={`Excluir sinal de ${sinal.ativo}`} />}
            />
          </div>
        ) : null}
      </div>

      <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm tabular-nums">
        <dt className="text-muted-foreground">{sinal.entradaAte ? "Zona de entrada" : "Entrada"}</dt>
        <dd className="text-right font-medium">
          {formatarPreco(sinal.entrada)}
          {sinal.entradaAte ? ` a ${formatarPreco(sinal.entradaAte)}` : ""}
        </dd>
        <dt className="text-muted-foreground">Stop</dt>
        <dd className="text-right font-medium">{formatarPreco(sinal.stop)}</dd>
        {sinal.alvos.map((alvo, i) => {
          const rr = riscoRetorno(sinal, alvo);
          return (
            <div key={i} className="contents">
              <dt className="text-muted-foreground">Alvo {i + 1}</dt>
              <dd className="text-right">
                <span className="font-medium">{formatarPreco(alvo)}</span>
                {rr !== null ? (
                  <span className="text-muted-foreground ml-2 text-xs" title="Risco/retorno">
                    1 : {rr.toFixed(1).replace(".", ",")}
                  </span>
                ) : null}
              </dd>
            </div>
          );
        })}
      </dl>

      <ResultadoDoCard sinal={sinal} simulacao={simulacao} />

      {sinal.observacao ? (
        <p className="text-muted-foreground mt-3 text-sm whitespace-pre-line">{sinal.observacao}</p>
      ) : null}

      {/*
        Só para quem publica: o aviso no Discord que não saiu. O sinal já está
        no site; o que falta é a comunidade ser avisada, e isso não pode ficar
        presumido.
      */}
      {ehAdmin && discordConfigurado && !sinal.discordEnviado && sinal.status === "aberto" ? (
        <div className="border-caution/40 bg-caution/10 mt-3 flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-xs">
          <span>{erroDiscord ?? "Aviso no Discord não enviado."}</span>
          <button
            type="button"
            disabled={reenviando}
            onClick={async () => {
              setReenviando(true);
              const falha = await acoes.reenviarSinalDiscord(sinal.id);
              setErroDiscord(falha ? (Object.values(falha)[0] ?? "Não foi possível reenviar.") : null);
              setReenviando(false);
            }}
            className="hover:bg-caution/20 focus-visible:ring-ring inline-flex shrink-0 items-center gap-1 rounded px-2 py-1 font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none disabled:opacity-60"
          >
            <Send className="size-3" aria-hidden="true" />
            {reenviando ? "Reenviando…" : "Reenviar"}
          </button>
        </div>
      ) : null}

      <p className="border-border text-muted-foreground mt-auto border-t pt-2.5 text-xs">
        Publicado {formatarQuando(sinal.publicadoEm)}
        {sinal.encerradoEm ? ` · fechado ${formatarQuando(sinal.encerradoEm)}` : ""}
      </p>
    </article>
  );
}

/** O resultado do sinal fechado: por onde saiu, a que preço, e quanto deu. */
function ResultadoDoCard({ sinal, simulacao }: { sinal: Sinal; simulacao: SimulacaoDolar | null }) {
  if (sinal.status === "cancelado") {
    return (
      <p className="border-border text-muted-foreground mt-3 rounded-md border px-3 py-2 text-sm">
        Não acionou: o preço não chegou na entrada.
      </p>
    );
  }
  if (sinal.status !== "encerrado" || !sinal.saida || !sinal.precoSaida) return null;
  const r = resultadoDoSinal(sinal, sinal.precoSaida);
  if (!r) return null;
  const dolar = simulacao ? resultadoEmDolar(r, simulacao) : null;
  return (
    <div
      className={cn(
        "mt-3 flex items-baseline justify-between gap-3 rounded-md border px-3 py-2 text-sm tabular-nums",
        r.desfecho === "lucro" && "border-positive/40 bg-positive/10",
        r.desfecho === "prejuizo" && "border-negative/40 bg-negative/10",
        r.desfecho === "empate" && "border-border",
      )}
    >
      <span className="text-muted-foreground">
        {rotuloSaida(sinal.saida)} · {formatarPreco(sinal.precoSaida)}
      </span>
      <span
        className={cn(
          "font-semibold",
          r.desfecho === "lucro" && "text-positive",
          r.desfecho === "prejuizo" && "text-negative",
        )}
      >
        {formatarPercentual(r.percentual)}
        {r.r !== null ? <span className="ml-1.5 text-xs font-medium">{formatarR(r.r)}</span> : null}
        {dolar !== null ? (
          <span className="block text-right text-xs font-medium">
            {formatUsd(cents(Math.round(dolar * 100)), { signDisplay: "exceptZero" })}
          </span>
        ) : null}
      </span>
    </div>
  );
}
