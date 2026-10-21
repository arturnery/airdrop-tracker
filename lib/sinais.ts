/**
 * Sinais de trade: a operação que o professor indica (ativo, direção,
 * entrada, stop, alvos), guardada como dado e mostrada em card.
 *
 * Puro, para a regra que importa ser testada sem banco: a coerência entre
 * direção e preços. Numa compra o stop fica abaixo da entrada e os alvos
 * acima; numa venda, o contrário. Um sinal que viole isso está errado, e
 * publicá-lo mandaria a comunidade operar um stop que não protege nada. É a
 * guarda que segura um número lido errado do print pela IA.
 */

export type Direcao = "compra" | "venda";

export type Sinal = {
  id: string;
  ativo: string;
  direcao: Direcao;
  /** Preços como texto decimal normalizado ("64200.5"), como vêm do banco. */
  entrada: string;
  /** Fim da zona de entrada, quando a entrada é uma faixa. */
  entradaAte: string | null;
  stop: string;
  alvos: string[];
  timeframe: string | null;
  observacao: string | null;
  status: "aberto" | "encerrado" | "cancelado";
  /** ISO 8601. */
  publicadoEm: string;
  /** Se o aviso no Discord saiu. Falso também quando o Discord não está configurado. */
  discordEnviado: boolean;
  /** Por onde saiu, a que preço e quando. Só no sinal encerrado. */
  saida?: Saida | null;
  precoSaida?: string | null;
  /** ISO 8601. Também no cancelado: é quando ele saiu da lista. */
  encerradoEm?: string | null;
  /** Quantas pessoas entraram na operação. */
  participantes?: number;
  /** Com quanto quem está vendo entrou, em dólar ("200.00"); null se não entrou. */
  minhaEntradaUsd?: string | null;
};

export type Saida = "alvo1" | "alvo2" | "alvo3" | "alvo4" | "stop" | "manual";

/** Como o sinal foi fechado na tela: uma saída, ou "não acionou". */
export type Fechamento = Saida | "cancelado";

/** Rótulo da saída, para o card e o placar. */
export function rotuloSaida(saida: Saida): string {
  if (saida === "stop") return "Stop";
  if (saida === "manual") return "Saída manual";
  return `Alvo ${saida.slice(-1)}`;
}

/**
 * O preço de saída que um fechamento implica: o do alvo ou o do stop, ou o
 * digitado na saída manual. `null` quando o alvo não existe no sinal ou o
 * preço manual não é válido.
 */
export function precoDaSaida(
  sinal: Pick<Sinal, "stop" | "alvos">,
  saida: Saida,
  manual: string | null,
): string | null {
  if (saida === "stop") return sinal.stop;
  if (saida === "manual") return manual;
  return sinal.alvos[Number(saida.slice(-1)) - 1] ?? null;
}

export type Resultado = {
  desfecho: "lucro" | "prejuizo" | "empate";
  /** Variação do preço a favor da operação, em % sobre a entrada. */
  percentual: number;
  /** Quantos riscos (distância até o stop) a operação ganhou ou perdeu. */
  r: number | null;
};

/**
 * O resultado de um sinal a partir do preço de saída, do mesmo jeito que o
 * risco/retorno: medido do meio da zona de entrada. Numa venda o sinal se
 * inverte, porque ganha quem vendeu acima de onde saiu.
 *
 * É o resultado da operação, não de uma conta: não sabe tamanho de posição,
 * alavancagem nem taxa. Por isso o placar soma R, que vale para qualquer
 * tamanho, e não dinheiro.
 */
export function resultadoDoSinal(
  sinal: Pick<Sinal, "direcao" | "entrada" | "entradaAte" | "stop">,
  precoSaida: string,
): Resultado | null {
  const entrada = (Number(sinal.entrada) + Number(sinal.entradaAte ?? sinal.entrada)) / 2;
  const saida = Number(precoSaida);
  if (!(entrada > 0) || !(saida > 0)) return null;
  const lado = sinal.direcao === "compra" ? 1 : -1;
  const movimento = (saida - entrada) * lado;
  const risco = Math.abs(entrada - Number(sinal.stop));
  // Arredonda o ruído de ponto flutuante: sair exatamente na entrada é empate.
  const percentual = Math.round((movimento / entrada) * 100 * 1e6) / 1e6;
  return {
    desfecho: percentual > 0 ? "lucro" : percentual < 0 ? "prejuizo" : "empate",
    percentual,
    r: risco > 0 ? Math.round((movimento / risco) * 1e6) / 1e6 : null,
  };
}

export type Placar = {
  /** Sinais encerrados com resultado (os cancelados não entram). */
  fechados: number;
  lucros: number;
  prejuizos: number;
  empates: number;
  /** Lucros sobre fechados, em %. `null` sem nenhum fechado. */
  taxaDeAcerto: number | null;
  somaR: number;
  somaPercentual: number;
};

/**
 * O placar da aba de resultados. Soma o mesmo `resultadoDoSinal` que cada
 * card mostra, para o total nunca discordar das linhas.
 */
export function placarDosSinais(sinais: Sinal[]): Placar {
  const placar: Placar = {
    fechados: 0,
    lucros: 0,
    prejuizos: 0,
    empates: 0,
    taxaDeAcerto: null,
    somaR: 0,
    somaPercentual: 0,
  };
  for (const sinal of sinais) {
    if (sinal.status !== "encerrado" || !sinal.precoSaida) continue;
    const r = resultadoDoSinal(sinal, sinal.precoSaida);
    if (!r) continue;
    placar.fechados += 1;
    if (r.desfecho === "lucro") placar.lucros += 1;
    else if (r.desfecho === "prejuizo") placar.prejuizos += 1;
    else placar.empates += 1;
    placar.somaR += r.r ?? 0;
    placar.somaPercentual += r.percentual;
  }
  if (placar.fechados > 0) placar.taxaDeAcerto = (placar.lucros / placar.fechados) * 100;
  return placar;
}

/**
 * Os campos do formulário de sinal, como texto digitado. É o formato que a IA
 * preenche e o que o formulário edita; `sinalSchema` transforma em `Sinal`.
 */
export type ValoresSinal = {
  ativo: string;
  direcao: Direcao;
  entrada: string;
  entradaAte: string;
  stop: string;
  alvos: [string, string, string, string];
  timeframe: string;
  observacao: string;
};

/**
 * Preço digitado (ou lido pela IA) para texto decimal normalizado.
 *
 * Preço de cripto vai de 0,00000123 a 100.000, então não dá para tratar
 * como dinheiro (duas casas). Aceita vírgula ou ponto como decimal; com os
 * dois presentes, o último é o decimal e o outro é milhar ("64.200,50" e
 * "64,200.50" dão 64200.5). Com um separador só, ele é o decimal, mesmo
 * com três dígitos depois: em preço de cripto "0.123" é muito mais comum
 * que "123 mil escrito com ponto", e o campo mostra embaixo como o número
 * foi entendido, para a pessoa conferir.
 */
export function lerPreco(bruto: string): string | null {
  const limpo = bruto.trim().replace(/[\s$]/g, "");
  if (limpo === "") return null;
  if (!/^\d[\d.,]*$/.test(limpo)) return null;

  const ultimoPonto = limpo.lastIndexOf(".");
  const ultimaVirgula = limpo.lastIndexOf(",");
  let normalizado: string;
  if (ultimoPonto >= 0 && ultimaVirgula >= 0) {
    const decimal = ultimoPonto > ultimaVirgula ? "." : ",";
    const milhar = decimal === "." ? "," : ".";
    normalizado = limpo.split(milhar).join("").replace(decimal, ".");
  } else {
    normalizado = limpo.replace(",", ".");
  }
  if (!/^\d+(\.\d+)?$/.test(normalizado)) return null;
  if (Number(normalizado) <= 0) return null;
  // Sem zeros à esquerda nem à direita sobrando: "064200.50" vira "64200.5".
  return normalizado.replace(/^0+(?=\d)/, "").replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "");
}

/** O que está incoerente entre direção e preços, por campo. Vazio: coerente. */
export function incoerencias(sinal: {
  direcao: Direcao;
  entrada: string;
  entradaAte: string | null;
  stop: string;
  alvos: string[];
}): Record<string, string> {
  const erros: Record<string, string> = {};
  const compra = sinal.direcao === "compra";
  const entradas = [Number(sinal.entrada), Number(sinal.entradaAte ?? sinal.entrada)];
  const piorEntrada = compra ? Math.min(...entradas) : Math.max(...entradas);
  const melhorEntrada = compra ? Math.max(...entradas) : Math.min(...entradas);
  const stop = Number(sinal.stop);

  if (compra ? stop >= piorEntrada : stop <= piorEntrada) {
    erros.stop = compra
      ? "Numa compra, o stop fica abaixo da entrada."
      : "Numa venda, o stop fica acima da entrada.";
  }
  sinal.alvos.forEach((alvo, i) => {
    const valor = Number(alvo);
    if (compra ? valor <= melhorEntrada : valor >= melhorEntrada) {
      erros[`alvo${i + 1}`] = compra
        ? "Numa compra, o alvo fica acima da entrada."
        : "Numa venda, o alvo fica abaixo da entrada.";
    }
  });
  return erros;
}

/**
 * Quanto se ganha no alvo para cada 1 arriscado até o stop, a partir do
 * meio da zona de entrada. `null` se a conta não fizer sentido.
 */
export function riscoRetorno(sinal: Pick<Sinal, "entrada" | "entradaAte" | "stop">, alvo: string): number | null {
  const entrada = (Number(sinal.entrada) + Number(sinal.entradaAte ?? sinal.entrada)) / 2;
  const risco = Math.abs(entrada - Number(sinal.stop));
  const retorno = Math.abs(Number(alvo) - entrada);
  if (!risco || !Number.isFinite(risco) || !Number.isFinite(retorno)) return null;
  return retorno / risco;
}

/** Preço para exibir: separador de milhar, todas as casas que o preço tem. */
export function formatarPreco(preco: string): string {
  const [inteiro, decimais] = preco.split(".");
  const comMilhar = Number(inteiro).toLocaleString("en-US");
  return decimais ? `${comMilhar}.${decimais}` : comMilhar;
}

/** "+2,49%" ou "-1,2%": com sinal sempre, para lucro e prejuízo não se confundirem. */
export function formatarPercentual(valor: number): string {
  const texto = Math.abs(valor).toLocaleString("pt-BR", { maximumFractionDigits: 2 });
  return `${valor > 0 ? "+" : valor < 0 ? "-" : ""}${texto}%`;
}

/** "+2,1R" ou "-1R": a medida que vale para qualquer tamanho de posição. */
export function formatarR(valor: number): string {
  const texto = Math.abs(valor).toLocaleString("pt-BR", { maximumFractionDigits: 1 });
  return `${valor > 0 ? "+" : valor < 0 ? "-" : ""}${texto}R`;
}

/**
 * Simulação em dólar que cada pessoa pode ligar na aba de resultados. O
 * sistema não sabe com quanto ela entrou; ela informa um valor fixo por
 * operação, de um destes jeitos:
 *
 * - `risco`: quanto perderia se o stop fosse atingido. O resultado é R × valor,
 *   que é como quem segue gestão de risco pensa (arriscar US$ 100 por trade).
 * - `posicao`: o tamanho da posição. O resultado é a variação % × valor, sem
 *   alavancagem.
 */
export type SimulacaoDolar = { modo: "risco" | "posicao"; valor: number };

/** O resultado de um sinal em dólar, na simulação. `null` se não der para calcular. */
export function resultadoEmDolar(resultado: Resultado, simulacao: SimulacaoDolar): number | null {
  if (simulacao.modo === "risco") return resultado.r === null ? null : resultado.r * simulacao.valor;
  return (resultado.percentual / 100) * simulacao.valor;
}

/**
 * Total em dólar dos sinais fechados, somando o mesmo `resultadoEmDolar` que
 * cada card mostra.
 */
export function totalEmDolar(sinais: Sinal[], simulacao: SimulacaoDolar): number {
  let total = 0;
  for (const sinal of sinais) {
    if (sinal.status !== "encerrado" || !sinal.precoSaida) continue;
    const r = resultadoDoSinal(sinal, sinal.precoSaida);
    const dolar = r ? resultadoEmDolar(r, simulacao) : null;
    if (dolar !== null) total += dolar;
  }
  return total;
}

/**
 * O resultado em dólar de quem entrou numa operação fechada: o valor de
 * entrada vezes a variação da operação, a mesma de `resultadoDoSinal`.
 * Operação aberta ou não acionada não tem resultado (null): quem entrou numa
 * que não acionou não ganhou nem perdeu.
 */
export function resultadoDaEntrada(sinal: Sinal, valorUsd: number): number | null {
  if (sinal.status !== "encerrado" || !sinal.precoSaida) return null;
  const r = resultadoDoSinal(sinal, sinal.precoSaida);
  return r ? (r.percentual / 100) * valorUsd : null;
}

export type MeuPlacar = {
  /** Operações fechadas em que a pessoa entrou. */
  operacoes: number;
  totalEntrado: number;
  resultadoUsd: number;
};

/**
 * O placar de quem está vendo, só com as operações em que entrou. Soma o
 * mesmo `resultadoDaEntrada` que cada card mostra. `null` se não entrou em
 * nenhuma operação fechada.
 */
export function meuPlacar(sinais: Sinal[]): MeuPlacar | null {
  let operacoes = 0;
  let totalEntrado = 0;
  let resultadoUsd = 0;
  for (const sinal of sinais) {
    if (!sinal.minhaEntradaUsd) continue;
    const valor = Number(sinal.minhaEntradaUsd);
    const resultado = resultadoDaEntrada(sinal, valor);
    if (resultado === null) continue;
    operacoes += 1;
    totalEntrado += valor;
    resultadoUsd += resultado;
  }
  return operacoes > 0 ? { operacoes, totalEntrado, resultadoUsd } : null;
}
