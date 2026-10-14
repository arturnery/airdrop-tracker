import { ExternalLink, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { urlExterna } from "@/lib/links";
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
  titleHref,
  titleAside,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  icon?: LucideIcon;
  titleClassName?: string;
  /**
   * Endereço externo que o título abre (o site do projeto). Só `http(s)`:
   * é texto que alguém digitou, e um `javascript:` ali viraria um link que
   * executa código ao ser clicado.
   */
  titleHref?: string | null;
  /** Ao lado do título, na mesma linha (o atalho do vídeo tutorial). */
  titleAside?: ReactNode;
}) {
  const link = urlExterna(titleHref);
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
              {link ? (
                <a
                  href={link}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={`Abrir o site de ${title}`}
                  className="hover:text-brand-legivel focus-visible:ring-ring group inline-flex items-center gap-2 rounded-sm underline-offset-4 transition-colors hover:underline focus-visible:ring-2 focus-visible:outline-none"
                >
                  {title}
                  <ExternalLink
                    className="text-muted-foreground group-hover:text-brand-legivel size-4 shrink-0"
                    aria-hidden="true"
                  />
                  <span className="sr-only">(abre o site em nova aba)</span>
                </a>
              ) : (
                title
              )}
            </h1>
            {titleAside}
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
