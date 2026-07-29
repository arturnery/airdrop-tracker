import { cn } from "@/lib/utils";
import { formatUsd, formatUsdCompact, type Cents } from "@/lib/money";

type Tone = "auto" | "neutral" | "muted";

/**
 * Valor monetário.
 *
 * Em `tone="auto"` a cor acompanha o sinal, mas o sinal em si já vem no texto
 * ("-$9.00"), então a cor nunca é a única informação — requisito de
 * acessibilidade. Números tabulares para as colunas alinharem.
 */
export function Money({
  value,
  tone = "neutral",
  compact = false,
  signed = false,
  className,
}: {
  value: Cents;
  tone?: Tone;
  compact?: boolean;
  signed?: boolean;
  className?: string;
}) {
  const texto = compact ? formatUsdCompact(value) : formatUsd(value);
  const comSinal = signed && value > 0 ? `+${texto}` : texto;

  return (
    <span
      className={cn(
        "tabular",
        tone === "auto" && value > 0 && "text-positive",
        tone === "auto" && value < 0 && "text-negative",
        tone === "muted" && "text-muted-foreground",
        className,
      )}
    >
      {comSinal}
    </span>
  );
}

/** Variação percentual. `null` (sem base de cálculo) vira travessão. */
export function Percent({
  value,
  className,
}: {
  value: number | null;
  className?: string;
}) {
  if (value === null) {
    return (
      <span className={cn("text-muted-foreground tabular", className)} title="Sem aporte para calcular">
        —
      </span>
    );
  }
  return (
    <span
      className={cn(
        "tabular",
        value > 0 && "text-positive",
        value < 0 && "text-negative",
        value === 0 && "text-muted-foreground",
        className,
      )}
    >
      {value > 0 ? "+" : ""}
      {value.toFixed(1)}%
    </span>
  );
}
