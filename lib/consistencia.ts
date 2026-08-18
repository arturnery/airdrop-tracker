import { isCashType } from "./finance";
import { fromDbNumeric, type Cents } from "./money";

/**
 * Saldos que a realidade não permite.
 *
 * O sistema soma o que foi lançado e mostra o resultado, sem opinar. Isso é
 * certo como regra geral e tem um custo: **um número impossível sai na tela com
 * a mesma cara de um número correto.** Um projeto apareceu com saldo de
 * −US$ 640 porque a perda no trade foi lançada e o depósito que a bancou não;
 * nada na tela dizia que aquilo não podia existir, e a suspeita recaiu sobre a
 * conta, que estava certa.
 *
 * O que se detecta aqui é falta de lançamento, e por isso a mensagem sugere em
 * vez de acusar: quem sabe o que aconteceu é quem lançou. O aviso some sozinho
 * quando o que falta for registrado, porque ele é derivado, não é uma marca
 * guardada em lugar nenhum.
 *
 * Fica em módulo próprio, puro, por ser regra que vale em qualquer tela e
 * precisa de teste sem banco.
 */

export type TipoAlerta = "saldo_negativo" | "sem_origem";

export type AlertaProjeto = {
  tipo: TipoAlerta;
  /** Curto, para caber ao lado do número numa tabela. */
  resumo: string;
  /** O que provavelmente falta, para quem for corrigir. */
  detalhe: string;
};

type LancamentoMinimo = {
  type: string;
  amountUsd: string;
};

export function diagnosticarProjeto(params: {
  exposicao: Cents;
  lancamentos: LancamentoMinimo[];
}): AlertaProjeto | null {
  const { exposicao, lancamentos } = params;

  const deCaixa = lancamentos.filter((l) => isCashType(l.type));
  const depositos = deCaixa.filter((l) => l.type === "deposit");

  /*
   * Negativo vem primeiro por ser o mais grave: os dois avisos podem valer ao
   * mesmo tempo, e "você tem menos de zero" é mais urgente do que "faltou
   * registrar de onde veio".
   */
  if (exposicao < 0) {
    return {
      tipo: "saldo_negativo",
      resumo: "saldo negativo",
      detalhe:
        "Não dá para ter menos de zero na plataforma. Em geral falta lançar o " +
        "depósito que bancou as perdas.",
    };
  }

  /*
   * Dinheiro que se move sem nunca ter entrado.
   *
   * A condição exige movimento **de caixa** que não seja depósito: só volume
   * operado não conta, porque volume é atividade e não dinheiro. E exige saldo
   * diferente de zero, senão um projeto que ganhou e perdeu o mesmo valor sem
   * depósito seria apontado sem ter o que corrigir na tela.
   */
  const temMovimentoSemSerDeposito = deCaixa.some((l) => l.type !== "deposit");

  if (depositos.length === 0 && temMovimentoSemSerDeposito && exposicao !== 0) {
    return {
      tipo: "sem_origem",
      resumo: "sem depósito",
      detalhe:
        "Há dinheiro lançado neste projeto e nenhum depósito registrado, então " +
        "o saldo aparece sem ter de onde vir. Se o valor veio de airdrop, ele " +
        "tem aba própria; se veio do seu bolso, falta o depósito.",
    };
  }

  return null;
}

/** Soma de caixa de um recorte, para quem precisa do saldo antes do alerta. */
export function saldoDeCaixa(lancamentos: LancamentoMinimo[]): number {
  return lancamentos
    .filter((l) => isCashType(l.type))
    .reduce<number>((acc, l) => acc + fromDbNumeric(l.amountUsd), 0);
}

/**
 * Projeto que se declara distribuído e não tem recebimento registrado.
 *
 * É a mesma natureza do alerta acima: **duas declarações da própria pessoa
 * discordando.** Uma diz "o airdrop deste projeto já saiu", a outra é a ausência
 * de qualquer recebimento cadastrado. Não há adivinhação de texto no meio, que
 * foi a alternativa descartada: procurar palavras como "venda" ou "token" na
 * descrição dos lançamentos achava 1 caso em 30 e dependia de como a frase foi
 * escrita naquele dia.
 *
 * **Não é erro de conta.** Quem lançou o valor como resultado de trade tem o
 * resultado correto; o que falta é o registro de token, quantidade e preço, e a
 * resposta para "quanto recebi de airdrop no total". Por isso o aviso vive só na
 * aba de airdrop do projeto, onde se age sobre ele, e não na lista nem no
 * painel: ali ele competiria com o alerta de saldo impossível, que significa
 * erro de verdade.
 */
export function faltaRegistrarRecebimento(params: {
  status: string;
  recebimentos: number;
}): boolean {
  return params.status === "distribuido" && params.recebimentos === 0;
}
