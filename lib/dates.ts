import type { IsoDate, TaskUrgency } from "./types";

/**
 * Datas de evento são "YYYY-MM-DD" sem timezone (ARCHITECTURE.md §5).
 *
 * Toda aritmética acontece sobre a data ao meio-dia UTC. Isso evita o bug
 * clássico de servidor em fuso negativo, onde `new Date("2026-07-28")` à
 * meia-noite UTC vira 27/07 no horário local e o item aparece "atrasado"
 * um dia antes.
 */

const MS_PER_DAY = 86_400_000;

function toUtcNoon(date: IsoDate): number {
  const [year, month, day] = date.split("-").map(Number);
  return Date.UTC(year!, month! - 1, day!, 12, 0, 0);
}

/** Dias de `from` até `to`. Negativo quando `to` já passou. */
export function daysBetween(from: IsoDate, to: IsoDate): number {
  return Math.round((toUtcNoon(to) - toUtcNoon(from)) / MS_PER_DAY);
}

export function urgencyOf(dueDate: IsoDate, today: IsoDate): TaskUrgency {
  const diff = daysBetween(today, dueDate);
  if (diff < 0) return "atrasada";
  if (diff === 0) return "hoje";
  return "proxima";
}

/** "2026-07-28" -> "28/07/2026" */
export function formatDateBr(date: IsoDate): string {
  const [year, month, day] = date.split("-");
  return `${day}/${month}/${year}`;
}

/** "2026-07-28" -> "28 jul" */
export function formatDateShort(date: IsoDate): string {
  const meses = [
    "jan", "fev", "mar", "abr", "mai", "jun",
    "jul", "ago", "set", "out", "nov", "dez",
  ];
  const [, month, day] = date.split("-");
  return `${day} ${meses[Number(month) - 1]}`;
}

/** Texto relativo curto para listas de tarefas. */
export function relativeLabel(dueDate: IsoDate, today: IsoDate): string {
  const diff = daysBetween(today, dueDate);
  if (diff === 0) return "hoje";
  if (diff === 1) return "amanhã";
  if (diff === -1) return "ontem";
  if (diff < 0) return `${Math.abs(diff)} dias atrás`;
  return `em ${diff} dias`;
}
