import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Cabeçalho de página: ícone da seção, título e descrição, dentro de uma
 * caixa só.
 *
 * O ícone é opcional de propósito: telas com título dinâmico (o nome do
 * projeto, "Projeto não encontrado") nem sempre têm uma seção fixa para
 * ilustrar, e um ícone genérico ali seria decoração sem informação.
 */
export function PageHeader({
  title,
  description,
  actions,
  icon: Icon,
  /** Estilo extra no título: usado para riscar projeto descartado. */
  titleClassName,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  icon?: LucideIcon;
  titleClassName?: string;
}) {
  return (
    <header className="border-border bg-card/40 mb-8 rounded-lg border p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            {Icon ? (
              <span
                aria-hidden="true"
                className="bg-brand/15 text-brand-legivel flex size-8 shrink-0 items-center justify-center rounded-md"
              >
                <Icon className="size-4" />
              </span>
            ) : null}
            <h1
              className={cn(
                "text-2xl font-semibold tracking-tight",
                titleClassName,
              )}
            >
              {title}
            </h1>
          </div>
          {description ? (
            <p className="text-muted-foreground mt-2 text-sm">{description}</p>
          ) : null}
        </div>
        {actions ? <div className="flex shrink-0 gap-2">{actions}</div> : null}
      </div>
    </header>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="border-border rounded-lg border border-dashed px-6 py-12 text-center">
      <p className="text-sm font-medium">{title}</p>
      <p className="text-muted-foreground mx-auto mt-1 max-w-md text-sm">
        {description}
      </p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
