import { formatUsd, type Cents } from "./money";
import type { GoalMetric } from "./types";

/**
 * As métricas de meta e como cada uma é mostrada.
 *
 * O valor da meta é guardado sempre do mesmo jeito (centésimos, como o
 * dinheiro), mas só as métricas em dólar são dinheiro. As outras (pontos,
 * transações, dias) são contagens, e mostrá-las com "$" fazia uma meta de
 * "50 mil pontos" aparecer como "$50,000.00".
 */
export const METRICAS_DE_META: { valor: GoalMetric; rotulo: string }[] = [
  { valor: "volume_usd", rotulo: "Volume (USD)" },
  { valor: "balance_usd", rotulo: "Saldo (USD)" },
  { valor: "points", rotulo: "Pontos" },
  { valor: "tx_count", rotulo: "Nº de transações" },
  { valor: "days_active", rotulo: "Dias ativos" },
];

export const metricaEmDolar = (metrica: GoalMetric) =>
  metrica === "volume_usd" || metrica === "balance_usd";

/** "$1,250.00" para dólar; "50.000" ou "12,5" para contagens. */
export function formatarValorDaMeta(metrica: GoalMetric, valor: Cents): string {
  if (metricaEmDolar(metrica)) return formatUsd(valor);
  return (valor / 100).toLocaleString("pt-BR", { maximumFractionDigits: 2 });
}

/** Para o campo de valor: dinheiro ou número, conforme a métrica. */
export const formatoDoCampo = (metrica: GoalMetric) =>
  metricaEmDolar(metrica) ? ("dinheiro" as const) : ("pontos" as const);
