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

/**
 * Fuso do projeto, e não o do aparelho.
 *
 * O servidor precisa de um fuso fixo, senão o dia depende de onde a Vercel
 * executou. Escolhido São Paulo, e não UTC, porque as três horas de diferença
 * mudam o dia: às 22h de Brasília o UTC já virou, e uma tarefa de "hoje"
 * apareceria como de amanhã.
 *
 * O navegador usa o **mesmo** fuso, e não o do sistema, para que "hoje"
 * signifique a mesma coisa nos dois lados. Com fusos diferentes, a tela
 * renderizada no servidor e o formulário preenchido no navegador poderiam
 * discordar sobre que dia é, o que é pior do que qualquer um dos dois estar
 * "errado" para quem viaja.
 */
const FUSO = "America/Sao_Paulo";

/*
 * Construído uma vez: montar um `Intl.DateTimeFormat` é a parte cara, e esta
 * função é chamada a cada render do provider no navegador.
 */
const formatadorDeDia = new Intl.DateTimeFormat("en-CA", {
  timeZone: FUSO,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/**
 * Que dia é hoje, em `aaaa-mm-dd`.
 *
 * Serve ao servidor a cada requisição e ao navegador enquanto a tela está
 * aberta. É a mesma função nos dois porque é a mesma pergunta: duas
 * implementações acabariam divergindo justamente na virada do dia, que é o
 * único momento em que a resposta importa.
 */
export function dataDeHoje(momento: Date = new Date()): IsoDate {
  return formatadorDeDia.format(momento);
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
