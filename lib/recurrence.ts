import { somarDias, isoParaData, dataParaIso } from "./dates";
import type { IsoDate } from "./types";

/**
 * Motor de recorrência: quais datas uma tarefa deveria ter numa janela.
 *
 * A alternativa seria um cron diário criando as ocorrências. Foi descartada
 * porque falha em silêncio: se o job cai numa noite, o dia seguinte simplesmente
 * não tem tarefas, e ninguém percebe que faltou. Aqui as datas são recalculadas
 * a cada leitura, então não existe estado a perder.
 *
 * Função pura de propósito: recebe a regra e a janela, devolve datas. Sem banco,
 * sem relógio próprio, o que a torna testável e faz o "hoje" ser sempre uma
 * decisão de quem chama.
 */

export type Recorrencia = "none" | "daily" | "weekly" | "monthly" | "every_n_days";

export type RegraRecorrencia = {
  recorrencia: Recorrencia;
  /** Só para `every_n_days`. */
  intervaloDias?: number | null;
  /**
   * Primeira data da série. Define o dia da semana da regra semanal e o dia do
   * mês da mensal: uma tarefa que começou numa terça continua caindo às terças.
   */
  ancora: IsoDate;
};

/** Janela fechada nas duas pontas, ambas inclusive. */
export type Janela = { de: IsoDate; ate: IsoDate };

/**
 * Soma meses preservando o dia quando possível.
 *
 * Dia 31 em mês de 30 vira o último dia do mês, não escorrega para o dia 1 do
 * mês seguinte, que é o que a aritmética ingênua de `setMonth` faria: uma tarefa
 * mensal do dia 31 acabaria caindo em datas cada vez mais distantes do
 * combinado.
 */
function somarMeses(iso: IsoDate, meses: number): IsoDate {
  const base = isoParaData(iso);
  const diaDesejado = base.getUTCDate();
  const alvo = new Date(
    Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + meses, 1, 12),
  );
  const ultimoDia = new Date(
    Date.UTC(alvo.getUTCFullYear(), alvo.getUTCMonth() + 1, 0, 12),
  ).getUTCDate();
  alvo.setUTCDate(Math.min(diaDesejado, ultimoDia));
  return dataParaIso(alvo);
}

/**
 * Datas devidas dentro da janela, em ordem crescente.
 *
 * Tarefa sem recorrência devolve a própria âncora, e só se ela cair na janela:
 * prazo fixo é uma ocorrência única, não uma série de uma.
 */
export function datasDevidas(regra: RegraRecorrencia, janela: Janela): IsoDate[] {
  const { recorrencia, ancora } = regra;

  if (recorrencia === "none") {
    return ancora >= janela.de && ancora <= janela.ate ? [ancora] : [];
  }

  const passo =
    recorrencia === "daily"
      ? 1
      : recorrencia === "weekly"
        ? 7
        : recorrencia === "every_n_days"
          ? Math.trunc(regra.intervaloDias ?? 0)
          : 0;

  // Intervalo inválido não vira laço infinito nem série de um dia só.
  if (recorrencia === "every_n_days" && passo < 1) return [];

  /**
   * A n-ésima data da série, sempre medida **a partir da âncora**.
   *
   * Isso não é preciosismo: avançar a partir da última data gerada faz a série
   * mensal derivar. Uma tarefa do dia 31 cai em 28 de fevereiro, e o mês
   * seguinte, contado a partir do 28, daria 28 de março em vez de 31. O erro
   * seria permanente, porque cada ajuste vira a nova base.
   */
  const nesima = (n: number): IsoDate =>
    recorrencia === "monthly"
      ? somarMeses(ancora, n)
      : somarDias(ancora, n * passo);

  const datas: IsoDate[] = [];

  /*
   * Teto de segurança: a âncora pode ser bem antiga (tarefa criada há anos), e
   * sem limite uma regra malformada rodaria para sempre. Generoso o bastante
   * para qualquer janela real, pequeno o bastante para falhar rápido.
   */
  const MAX_PASSOS = 10_000;

  for (let n = 0; n < MAX_PASSOS; n += 1) {
    const data = nesima(n);
    if (data > janela.ate) break;
    if (data >= janela.de) datas.push(data);
  }

  return datas;
}

/**
 * Janela padrão de materialização: uma semana atrás, trinta dias à frente.
 *
 * Para trás porque quem some por alguns dias precisa ver o que ficou atrasado,
 * e não encontrar um painel limpo como se nada tivesse vencido. Para a frente o
 * suficiente para planejar o mês sem encher o banco de datas distantes que
 * podem nunca ser cumpridas.
 */
export function janelaPadrao(hoje: IsoDate): Janela {
  return { de: somarDias(hoje, -7), ate: somarDias(hoje, 30) };
}
