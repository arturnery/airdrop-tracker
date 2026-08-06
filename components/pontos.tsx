"use client";

import Link from "next/link";

import { formatPoints, formatPointsDelta, ZERO_PONTOS } from "@/lib/points";
import { formatDateBr, relativeLabel } from "@/lib/dates";
import { cn } from "@/lib/utils";
import type { PointsProgramRow } from "@/lib/types";

/**
 * Cartão de um programa de pontos.
 *
 * Cada programa é uma unidade própria: nunca há um total somando projetos
 * diferentes, porque 1.000 pontos de um projeto e 1.000 de outro não formam 2.000
 * de nada. O que se compara entre projetos é a **variação**, não o acumulado.
 */
export function CardPrograma({
  programa,
  hoje,
}: {
  programa: PointsProgramRow;
  hoje: string;
}) {
  const variacao = programa.variacao;

  return (
    <article className="bg-card border-border relative rounded-lg border p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-medium">
            <Link
              href={`/projetos/${programa.projetoSlug}`}
              className="focus-visible:ring-ring rounded-sm underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:outline-none"
            >
              {programa.projetoNome}
            </Link>
          </h3>
          <p className="text-muted-foreground mt-0.5 text-xs">{programa.rotulo}</p>
        </div>
        {programa.atualizadoEm ? (
          <span
            className="text-muted-foreground shrink-0 text-xs"
            title={formatDateBr(programa.atualizadoEm)}
          >
            {relativeLabel(programa.atualizadoEm, hoje)}
          </span>
        ) : null}
      </div>

      <p className="font-numeric mt-4 text-3xl leading-none font-semibold">
        {formatPoints(programa.total)}
      </p>

      <div className="mt-3 flex items-center gap-2 text-xs">
        {variacao === null ? (
          <span className="text-muted-foreground">
            primeira medição: sem base de comparação
          </span>
        ) : (
          <>
            <span
              className={cn(
                "tabular font-medium",
                variacao > ZERO_PONTOS && "text-positive",
                variacao < ZERO_PONTOS && "text-negative",
                variacao === ZERO_PONTOS && "text-muted-foreground",
              )}
            >
              {formatPointsDelta(variacao)}
            </span>
            {programa.crescimento !== null ? (
              <span className="text-muted-foreground tabular">
                ({programa.crescimento > 0 ? "+" : ""}
                {programa.crescimento.toFixed(1)}%)
              </span>
            ) : null}
            <span className="text-muted-foreground">desde a medição anterior</span>
          </>
        )}
      </div>

      {programa.contas.length > 1 ? (
        <ul className="border-border mt-4 space-y-1.5 border-t pt-3">
          {programa.contas.map((conta) => (
            <li
              key={conta.contaId}
              className="flex items-baseline justify-between gap-3 text-xs"
            >
              <span className="text-muted-foreground truncate">{conta.label}</span>
              <span className="flex shrink-0 items-baseline gap-2">
                <span className="tabular">
                  {conta.total === null ? "-" : formatPoints(conta.total)}
                </span>
                {conta.variacao !== null && conta.variacao !== ZERO_PONTOS ? (
                  <span
                    className={cn(
                      "tabular",
                      conta.variacao > ZERO_PONTOS ? "text-positive" : "text-negative",
                    )}
                  >
                    {formatPointsDelta(conta.variacao)}
                  </span>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </article>
  );
}
