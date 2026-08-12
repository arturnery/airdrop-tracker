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
/**
 * Data de hoje no fuso de quem usa, no formato `aaaa-mm-dd`.
 *
 * Roda no servidor a cada requisição, porque todas as rotas são dinâmicas.
 * A versão anterior usava uma constante das fixtures, com a justificativa de
 * que `new Date()` congelaria a data no momento do build: isso valia quando
 * havia páginas pré-renderizadas, e deixou de valer.
 *
 * O fuso é fixo em São Paulo em vez de UTC porque a diferença de três horas
 * muda o dia: às 22h de Brasília o UTC já virou, e uma tarefa marcada para
 * "hoje" apareceria como sendo de amanhã.
 */
export function hojeNoServidor(): IsoDate {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

const DIA_MS = 86_400_000;

/**
 * Data de calendário como instante ao meio-dia UTC.
 *
 * O meio-dia evita que fuso horário empurre a data para o dia anterior: à
 * meia-noite, qualquer deslocamento negativo já muda o dia.
 */
export function isoParaData(iso: IsoDate): Date {
  const [ano, mes, dia] = iso.split("-").map(Number);
  return new Date(Date.UTC(ano!, mes! - 1, dia!, 12));
}

export function dataParaIso(data: Date): IsoDate {
  return data.toISOString().slice(0, 10);
}

/**
 * Soma dias a uma data de calendário.
 *
 * Vive aqui, e não em quem usa, porque já eram duas implementações: o motor de
 * recorrência tinha a sua e o cálculo de volume precisou da mesma conta.
 */
export function somarDias(iso: IsoDate, dias: number): IsoDate {
  return dataParaIso(new Date(isoParaData(iso).getTime() + dias * DIA_MS));
}

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

/**
 * Data por extenso: "11 de agosto de 2026".
 *
 * Existe para confirmar a data escolhida sem depender de ordem de números.
 * A confirmação anterior mostrava `dd/mm/aaaa` logo abaixo de um campo que o
 * navegador exibe em `mm/dd/aaaa`, e ver 11/08 embaixo de 08/11 levanta a
 * dúvida em vez de resolvê-la: os dois são a mesma data, e parecem duas.
 *
 * Por extenso não há ordem a interpretar.
 */
export function formatDateExtenso(date: IsoDate): string {
  const meses = [
    "janeiro", "fevereiro", "março", "abril", "maio", "junho",
    "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
  ];
  const [ano, mes, dia] = date.split("-");
  return `${Number(dia)} de ${meses[Number(mes) - 1]} de ${ano}`;
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
