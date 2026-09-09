"use client";

import { CircleDollarSign, TriangleAlert } from "lucide-react";

import { useDados } from "@/components/data-provider";
import {
  BotaoLixeira,
  ConfirmarExclusao,
} from "@/components/forms/confirmar-exclusao";
import { DefinirCotacao } from "@/components/forms/dialogs";
import { Money } from "@/components/money";
import { EmptyState, PageHeader } from "@/components/page-header";
import { formatDateBr, relativeLabel } from "@/lib/dates";
import { selectCotacoes } from "@/lib/selectors";

/**
 * Cotações informadas manualmente.
 *
 * Sem API externa por decisão de projeto. O preço vale até ser atualizado, e a
 * data fica visível justamente para deixar claro quando ficou velho: cotação
 * de duas semanas atrás avaliando a posição de hoje é pior que nenhuma.
 */
export function CotacoesView() {
  const { dataset, hoje, acoes } = useDados();
  const cotacoes = selectCotacoes(dataset);

  const semPreco = cotacoes.filter((c) => c.atualizadoEm === "");

  return (
    <>
      <PageHeader
        icon={CircleDollarSign}
        title="Cotações"
        description="Preço dos tokens em que você tem posição. Atualize antes de olhar os números."
        actions={<DefinirCotacao />}
      />

      {semPreco.length > 0 ? (
        <p className="border-caution/30 bg-caution/5 text-muted-foreground mb-6 flex items-start gap-2 rounded-md border px-4 py-3 text-sm">
          <TriangleAlert
            className="text-caution mt-0.5 size-4 shrink-0"
            aria-hidden="true"
          />
          <span>
            <strong className="text-foreground font-medium">
              {semPreco.map((c) => c.symbol).join(", ")} sem cotação.
            </strong>{" "}
            Enquanto isso, a posição nesses tokens é avaliada pelo valor em dólar do
            aporte: ou seja, sem ganho nem perda de preço.
          </span>
        </p>
      ) : null}

      {cotacoes.length === 0 ? (
        <EmptyState
          title="Nenhum token registrado"
          description="Assim que você lançar um aporte em token, ele aparece aqui para você informar o preço."
        />
      ) : (
        <div className="border-border overflow-x-auto rounded-lg border">
          <table className="w-full min-w-160 text-sm">
            <caption className="sr-only">Cotação de cada token</caption>
            <thead>
              <tr className="border-border text-muted-foreground border-b text-left text-xs">
                <th scope="col" className="px-4 py-2.5 font-medium">Token</th>
                <th scope="col" className="px-4 py-2.5 text-right font-medium">Preço</th>
                <th scope="col" className="px-4 py-2.5 text-right font-medium">Projetos</th>
                <th scope="col" className="px-4 py-2.5 text-right font-medium">Atualizado</th>
                <th scope="col" className="px-4 py-2.5 text-right font-medium">
                  <span className="sr-only">Ações</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-border divide-y">
              {cotacoes.map((cotacao) => {
                const informada = cotacao.atualizadoEm !== "";
                return (
                  <tr
                    key={cotacao.symbol}
                    className="hover:bg-accent/40 transition-colors"
                  >
                    <th scope="row" className="px-4 py-3 text-left font-medium">
                      {cotacao.symbol}
                    </th>
                    <td className="px-4 py-3 text-right">
                      {informada ? (
                        <Money value={cotacao.precoUsd} />
                      ) : (
                        <span className="text-caution text-xs">não informada</span>
                      )}
                    </td>
                    <td className="text-muted-foreground tabular px-4 py-3 text-right">
                      {cotacao.usadoEm}
                    </td>
                    <td className="text-muted-foreground px-4 py-3 text-right text-xs">
                      {informada ? (
                        <span title={formatDateBr(cotacao.atualizadoEm)}>
                          {relativeLabel(cotacao.atualizadoEm, hoje)}
                        </span>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td className="px-2 py-2">
                      <div className="flex items-center justify-end gap-1">
                        <DefinirCotacao symbol={cotacao.symbol} />
                        {informada ? (
                          <ConfirmarExclusao
                            titulo="Remover cotação"
                            alvo={`Preço de ${cotacao.symbol}`}
                            impacto="A posição nesse token volta a ser avaliada pelo valor aportado"
                            aoConfirmar={() => acoes.excluirCotacao(cotacao.symbol)}
                            gatilho={
                              <BotaoLixeira
                                rotulo={`Remover cotação de ${cotacao.symbol}`}
                              />
                            }
                          />
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
