/**
 * Calendário da comunidade: quando cada live acontece, a partir do que foi
 * cadastrado, e a grade do mês onde as ocorrências são desenhadas.
 *
 * Puro, como o motor de recorrência das tarefas (ARCHITECTURE §6): recebe as
 * lives e o intervalo, devolve as ocorrências. Uma live semanal ou quinzenal
 * não gera linha nova a cada vez; as datas são calculadas na leitura.
 *
 * Horário de Brasília em toda a interface. O Brasil não tem horário de verão
 * desde 2019, então o deslocamento é fixo em -03:00, e a conversão de "dia e
 * hora digitados" para instante pode ser feita sem tabela de fuso.
 */

export type Recorrencia = "nenhuma" | "semanal" | "quinzenal";

export type Live = {
  id: string;
  titulo: string;
  apresentador: string | null;
  descricao: string | null;
  link: string | null;
  /** ISO 8601, com fuso. Numa live recorrente, é a primeira ocorrência. */
  inicioEm: string;
  recorrencia: Recorrencia;
  /** Último dia (`aaaa-mm-dd`, em Brasília) da recorrência; nulo, sem fim. */
  repetirAte: string | null;
  destaque: boolean;
};

export type Ocorrencia = {
  live: Live;
  /** ISO 8601 em UTC. */
  quando: string;
  /** O dia em Brasília (`aaaa-mm-dd`), que é a célula onde ela aparece. */
  dia: string;
  /** Começou há menos de `DURACAO_PRESUMIDA_MS`. */
  aoVivo: boolean;
};

const DIA_MS = 24 * 60 * 60 * 1000;
const PASSO_MS: Record<Exclude<Recorrencia, "nenhuma">, number> = {
  semanal: 7 * DIA_MS,
  quinzenal: 14 * DIA_MS,
};

/*
 * A live não tem duração cadastrada, e pedir uma seria um campo a mais que
 * quase ninguém sabe de antemão. Duas horas é o tempo em que ela continua
 * marcada como "ao vivo" depois de começar.
 */
export const DURACAO_PRESUMIDA_MS = 2 * 60 * 60 * 1000;

const DESLOCAMENTO_MS = 3 * 60 * 60 * 1000;

/** Dia (`aaaa-mm-dd`) e hora (`hh:mm`) de Brasília para instante ISO. */
export function instanteDeBrasilia(dia: string, hora: string): string {
  return new Date(`${dia}T${hora}:00-03:00`).toISOString();
}

/** O inverso, para preencher o formulário de edição e achar a célula. */
export function diaEHoraDeBrasilia(iso: string): { dia: string; hora: string } {
  const local = new Date(new Date(iso).getTime() - DESLOCAMENTO_MS).toISOString();
  return { dia: local.slice(0, 10), hora: local.slice(11, 16) };
}

/** "19h" ou "18h30", como numa grade de programação. */
export function horaCurta(iso: string): string {
  const [h, m] = diaEHoraDeBrasilia(iso).hora.split(":");
  return m === "00" ? `${Number(h)}h` : `${Number(h)}h${m}`;
}

/**
 * Todas as ocorrências com início em `[de, ate)`, da mais cedo para a mais
 * tarde. `agora` só decide o "ao vivo".
 */
export function ocorrenciasEntre(
  lives: Live[],
  de: Date,
  ate: Date,
  agora: Date,
): Ocorrencia[] {
  const saida: Ocorrencia[] = [];

  for (const live of lives) {
    const inicio = new Date(live.inicioEm).getTime();
    const instantes: number[] = [];

    if (live.recorrencia === "nenhuma") {
      if (inicio >= de.getTime() && inicio < ate.getTime()) instantes.push(inicio);
    } else {
      const passo = PASSO_MS[live.recorrencia];
      // "Repetir até 31/03" inclui o dia 31 inteiro, em Brasília.
      const fim = live.repetirAte
        ? Math.min(ate.getTime(), new Date(instanteDeBrasilia(live.repetirAte, "00:00")).getTime() + DIA_MS)
        : ate.getTime();
      // Primeira repetição dentro do intervalo, nunca antes do início real.
      const saltos = Math.max(0, Math.ceil((de.getTime() - inicio) / passo));
      for (let t = inicio + saltos * passo; t < fim; t += passo) {
        instantes.push(t);
      }
    }

    for (const t of instantes) {
      const quando = new Date(t).toISOString();
      saida.push({
        live,
        quando,
        dia: diaEHoraDeBrasilia(quando).dia,
        aoVivo: t <= agora.getTime() && agora.getTime() - t < DURACAO_PRESUMIDA_MS,
      });
    }
  }

  return saida.sort((a, b) => a.quando.localeCompare(b.quando));
}

// -------------------------------------------------------------------- mês

/** `aaaa-mm` do instante, no calendário de Brasília. */
export function mesDeBrasilia(agora: Date): string {
  return diaEHoraDeBrasilia(agora.toISOString()).dia.slice(0, 7);
}

/** Aceita só `aaaa-mm` válido; qualquer outra coisa volta `null`. */
export function lerMes(valor: unknown): string | null {
  if (typeof valor !== "string" || !/^\d{4}-(0[1-9]|1[0-2])$/.test(valor)) return null;
  return valor;
}

export function deslocarMes(mes: string, meses: number): string {
  const [ano, m] = mes.split("-").map(Number);
  const d = new Date(Date.UTC(ano!, m! - 1 + meses, 1));
  return d.toISOString().slice(0, 7);
}

/** Do primeiro instante do mês em Brasília ao primeiro do mês seguinte. */
export function limitesDoMes(mes: string): { de: Date; ate: Date } {
  return {
    de: new Date(instanteDeBrasilia(`${mes}-01`, "00:00")),
    ate: new Date(instanteDeBrasilia(`${deslocarMes(mes, 1)}-01`, "00:00")),
  };
}

/**
 * As semanas do mês, de domingo a sábado. Os dias de fora do mês, que
 * completam a primeira e a última semana, vêm como `null`: a grade da
 * imagem de referência os deixa vazios, e isso evita a dúvida de "esse 1º
 * é deste mês ou do próximo?".
 */
export function semanasDoMes(mes: string): (string | null)[][] {
  const [ano, m] = mes.split("-").map(Number);
  const primeiro = new Date(Date.UTC(ano!, m! - 1, 1));
  const totalDias = new Date(Date.UTC(ano!, m!, 0)).getUTCDate();

  const celulas: (string | null)[] = Array(primeiro.getUTCDay()).fill(null);
  for (let d = 1; d <= totalDias; d++) {
    celulas.push(`${mes}-${String(d).padStart(2, "0")}`);
  }
  while (celulas.length % 7 !== 0) celulas.push(null);

  const semanas: (string | null)[][] = [];
  for (let i = 0; i < celulas.length; i += 7) semanas.push(celulas.slice(i, i + 7));
  return semanas;
}

const formatoMes = new Intl.DateTimeFormat("pt-BR", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

/*
 * Maiúscula só na primeira letra, feita aqui e não com `capitalize` no CSS:
 * o CSS sobe a inicial de cada palavra, e "Março De 2026" ou
 * "Segunda-Feira" não são português.
 */
const comInicialMaiuscula = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** "Março de 2026". */
export function nomeDoMes(mes: string): string {
  return comInicialMaiuscula(formatoMes.format(new Date(`${mes}-01T12:00:00Z`)));
}

const formatoDiaPorExtenso = new Intl.DateTimeFormat("pt-BR", {
  weekday: "long",
  day: "2-digit",
  month: "2-digit",
  timeZone: "UTC",
});

/** "Segunda-feira, 02/03", para a lista do celular. */
export function nomeDoDia(dia: string): string {
  return comInicialMaiuscula(formatoDiaPorExtenso.format(new Date(`${dia}T12:00:00Z`)));
}

const formatoData = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  weekday: "short",
  day: "2-digit",
  month: "2-digit",
});
const formatoHora = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  hour: "2-digit",
  minute: "2-digit",
});

/** "qua., 15/10 às 20:00", sempre no horário de Brasília. */
export function formatarQuando(iso: string): string {
  const d = new Date(iso);
  return `${formatoData.format(d)} às ${formatoHora.format(d)}`;
}
