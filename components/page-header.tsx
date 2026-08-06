import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export function PageHeader({
  title,
  description,
  actions,
  /** Estilo extra no título: usado para riscar projeto descartado. */
  titleClassName,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  titleClassName?: string;
}) {
  return (
    <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1
          className={cn("text-2xl font-semibold tracking-tight", titleClassName)}
        >
          {title}
        </h1>
        {description ? (
          <p className="text-muted-foreground mt-1 text-sm">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex gap-2">{actions}</div> : null}
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
