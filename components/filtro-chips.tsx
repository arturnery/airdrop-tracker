"use client";

import { cn } from "@/lib/utils";

/**
 * Grupo de filtros como botões alternáveis.
 *
 * Usa `aria-pressed` em vez de estilo apenas: o leitor de tela anuncia
 * "pressionado", então o estado do filtro não depende de perceber a cor.
 */
export function FiltroChips<T extends string>({
  legenda,
  opcoes,
  selecionado,
  aoSelecionar,
}: {
  legenda: string;
  opcoes: { valor: T | null; rotulo: string; contagem?: number }[];
  selecionado: T | null;
  aoSelecionar: (valor: T | null) => void;
}) {
  return (
    <fieldset className="flex flex-wrap items-center gap-2">
      <legend className="text-muted-foreground sr-only">{legenda}</legend>
      <span className="text-muted-foreground text-xs" aria-hidden="true">
        {legenda}
      </span>
      {opcoes.map((opcao) => {
        const ativo = selecionado === opcao.valor;
        return (
          <button
            key={opcao.valor ?? "todos"}
            type="button"
            aria-pressed={ativo}
            onClick={() => aoSelecionar(opcao.valor)}
            className={cn(
              "focus-visible:ring-ring rounded-md border px-2.5 py-1 text-xs transition-colors focus-visible:ring-2 focus-visible:outline-none",
              ativo
                ? "border-brand/50 bg-brand/10 text-brand-legivel font-medium"
                : "border-border text-muted-foreground hover:border-brand/30 hover:text-foreground",
            )}
          >
            {opcao.rotulo}
            {opcao.contagem !== undefined ? (
              <span className="tabular ml-1.5 opacity-60">{opcao.contagem}</span>
            ) : null}
          </button>
        );
      })}
    </fieldset>
  );
}
