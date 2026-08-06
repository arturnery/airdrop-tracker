import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type Accent = "primary" | "positive" | "negative" | "caution" | "idle";

const accentBorder: Record<Accent, string> = {
  primary: "border-l-primary",
  positive: "border-l-positive",
  negative: "border-l-negative",
  caution: "border-l-caution",
  idle: "border-l-border",
};

/**
 * Cartão de indicador. O valor usa a serif do tema: número é o que o olho
 * procura primeiro nesta tela, e a mudança de família o destaca sem precisar
 * de cor forte.
 */
export function StatCard({
  label,
  value,
  hint,
  accent = "idle",
  className,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  accent?: Accent;
  className?: string;
}) {
  return (
    <article
      className={cn(
        "bg-card rounded-lg border border-l-4 p-6",
        accentBorder[accent],
        className,
      )}
    >
      <h3 className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
        {label}
      </h3>
      <p className="font-numeric mt-3 text-3xl leading-none font-semibold">
        {value}
      </p>
      {hint ? (
        <p className="text-muted-foreground mt-2 text-xs">{hint}</p>
      ) : null}
    </article>
  );
}
