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
};

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
