/**
 * Lives da comunidade: quando acontecem, a partir do que foi cadastrado.
 *
 * Puro, como o motor de recorrência das tarefas (ARCHITECTURE §6): recebe as
 * lives e o instante atual, devolve as ocorrências. Uma live semanal não gera
 * linha nova a cada semana; a próxima data é calculada na leitura.
 *
 * Horário de Brasília em toda a interface. O Brasil não tem horário de verão
 * desde 2019, então o deslocamento é fixo em -03:00, e a conversão de "dia e
 * hora digitados" para instante pode ser feita sem tabela de fuso.
 */

export type Live = {
  id: string;
  titulo: string;
  descricao: string | null;
  link: string | null;
  /** ISO 8601, com fuso. Numa live semanal, é a primeira ocorrência. */
  inicioEm: string;
  semanal: boolean;
};

export type Ocorrencia = {
  liveId: string;
  titulo: string;
  descricao: string | null;
  link: string | null;
  semanal: boolean;
  /** ISO 8601 em UTC. */
  quando: string;
  /** Começou há menos de `DURACAO_PRESUMIDA_MS`. */
  aoVivo: boolean;
};

const SEMANA_MS = 7 * 24 * 60 * 60 * 1000;

/*
 * A live não tem duração cadastrada, e pedir uma seria um campo a mais que
 * quase ninguém sabe de antemão. Duas horas é o tempo em que ela continua
 * listada como "ao vivo" depois de começar, para quem chega atrasado ainda
 * achar o link.
 */
export const DURACAO_PRESUMIDA_MS = 2 * 60 * 60 * 1000;

const FUSO_BRASILIA = "-03:00";

/** Dia (`aaaa-mm-dd`) e hora (`hh:mm`) de Brasília para instante ISO. */
export function instanteDeBrasilia(dia: string, hora: string): string {
  return new Date(`${dia}T${hora}:00${FUSO_BRASILIA}`).toISOString();
}

/** O inverso, para preencher o formulário de edição. */
export function diaEHoraDeBrasilia(iso: string): { dia: string; hora: string } {
  const local = new Date(new Date(iso).getTime() - 3 * 60 * 60 * 1000).toISOString();
  return { dia: local.slice(0, 10), hora: local.slice(11, 16) };
}

/**
 * As ocorrências entre agora (incluindo as que ainda estão no ar) e
 * `dias` à frente, da mais próxima para a mais distante.
 */
export function proximasOcorrencias(
  lives: Live[],
  agora: Date,
  dias: number,
): Ocorrencia[] {
  const desde = agora.getTime() - DURACAO_PRESUMIDA_MS;
  const ate = agora.getTime() + dias * 24 * 60 * 60 * 1000;
  const saida: Ocorrencia[] = [];

  for (const live of lives) {
    const inicio = new Date(live.inicioEm).getTime();
    const instantes: number[] = [];

    if (!live.semanal) {
      if (inicio >= desde && inicio <= ate) instantes.push(inicio);
    } else {
      // Primeira semana cuja ocorrência ainda não passou da janela "ao vivo".
      const semanasPassadas = Math.max(0, Math.ceil((desde - inicio) / SEMANA_MS));
      for (let t = inicio + semanasPassadas * SEMANA_MS; t <= ate; t += SEMANA_MS) {
        instantes.push(t);
      }
    }

    for (const t of instantes) {
      saida.push({
        liveId: live.id,
        titulo: live.titulo,
        descricao: live.descricao,
        link: live.link,
        semanal: live.semanal,
        quando: new Date(t).toISOString(),
        aoVivo: t <= agora.getTime() && agora.getTime() - t < DURACAO_PRESUMIDA_MS,
      });
    }
  }

  return saida.sort((a, b) => a.quando.localeCompare(b.quando));
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
