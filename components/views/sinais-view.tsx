"use client";

import { ArrowDownRight, ArrowUpRight, ChartCandlestick } from "lucide-react";

import { BotaoLixeira, ConfirmarExclusao } from "@/components/forms/confirmar-exclusao";
import { NovoSinal } from "@/components/forms/sinal";
import { useDados } from "@/components/data-provider";
import { EmptyState, PageHeader } from "@/components/page-header";
import { formatarQuando } from "@/lib/lives";
import { formatarPreco, riscoRetorno, type Sinal } from "@/lib/sinais";

const ROTULO_STATUS: Record<Sinal["status"], string> = {
  aberto: "Aberto",
  encerrado: "Encerrado",
  cancelado: "Cancelado",
};

/**
 * Sinais de trade, um card por operação, do mais recente ao mais antigo.
 *
 * A direção vai em selo neutro, com seta, e não em verde e vermelho: aqui
 * essas duas cores são de lucro e prejuízo (ARCHITECTURE §14.8), e vão
 * marcar o PnL do sinal quando o acompanhamento entrar. Um sinal de venda em
 * vermelho pareceria prejuízo antes de existir resultado.
 */
export function SinaisView({ sinais, ehAdmin }: { sinais: Sinal[]; ehAdmin: boolean }) {
  return (
    <>
      <PageHeader
        icon={ChartCandlestick}
        title="Sinais"
        description="Operações indicadas na área de trade: entrada, stop e alvos de cada uma."
        actions={ehAdmin ? <NovoSinal /> : null}
      />

      {sinais.length === 0 ? (
        <EmptyState
          title="Nenhum sinal publicado ainda."
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
              <CardSinal sinal={sinal} ehAdmin={ehAdmin} />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function CardSinal({ sinal, ehAdmin }: { sinal: Sinal; ehAdmin: boolean }) {
  const { acoes } = useDados();
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
          <ConfirmarExclusao
            titulo="Excluir sinal"
            alvo={`${compra ? "Compra" : "Venda"} de ${sinal.ativo}`}
            aoConfirmar={() => acoes.excluirSinal(sinal.id)}
            gatilho={<BotaoLixeira rotulo={`Excluir sinal de ${sinal.ativo}`} />}
          />
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

      {sinal.observacao ? (
        <p className="text-muted-foreground mt-3 text-sm whitespace-pre-line">{sinal.observacao}</p>
      ) : null}

      <p className="border-border text-muted-foreground mt-auto border-t pt-2.5 text-xs">
        Publicado {formatarQuando(sinal.publicadoEm)}
      </p>
    </article>
  );
}
