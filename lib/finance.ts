import { addCents, cents, fromDbNumeric, percentOf, ZERO, type Cents } from "./money";
import type { FinancialSummary } from "./types";

/**
 * Agregação financeira. Módulo puro: recebe linhas no formato que o banco
 * devolve e devolve totais. Sem Drizzle, sem React: testável direto.
 *
 * O sistema é um **livro-razão**: o saldo de um par projeto×conta é a soma de
 * tudo que foi lançado nele. Não existe registro de saldo em separado, então
 * todo centavo em tela tem um lançamento que o explica. A contrapartida é que
 * variação não registrada não aparece: quem lança é o usuário.
 *
 * As fórmulas estão em ARCHITECTURE.md §5.
 */

export type MovementRow = {
  projectId: string;
  accountId: string;
  type: string;
  amountUsd: string;
  tokenSymbol?: string | null;
  tokenAmount?: string | null;
};

export type TokenPriceRow = {
  symbol: string;
  priceUsd: string;
};

export type PairKey = string;

export const pairKey = (projectId: string, accountId: string): PairKey =>
  `${projectId}::${accountId}`;

/**
 * Movimentos que alteram o saldo dentro da plataforma.
 *
 * `volume_traded` fica de fora: é métrica de atividade, não de caixa: somá-lo
 * inflaria o capital. `fee_gas` também fica de fora do saldo porque sai do
 * bolso, não da posição; entra no resultado como custo (§5).
 */
const CASH_TYPES = ["deposit", "withdrawal", "trade_pnl", "yield"] as const;

export function isCashType(type: string): boolean {
  return (CASH_TYPES as readonly string[]).includes(type);
}

// -------------------------------------------------------------- sinal

/**
 * Para que lado o tipo move o dinheiro.
 *
 * `ambos` existe porque resultado de trade é lucro ou prejuízo, e forçar um
 * sinal ali obrigaria a inventar dois tipos para a mesma coisa.
 */
export type Direcao = "entrada" | "saida" | "ambos";

export function direcaoDoTipo(type: string): Direcao {
  switch (type) {
    case "withdrawal":
    case "fee_gas":
      return "saida";
    case "deposit":
    case "yield":
    case "volume_traded":
      return "entrada";
    default:
      // trade_pnl e other: quem lança decide.
      return "ambos";
  }
}

/**
 * Aplica ao valor o sinal que o tipo exige.
 *
 * O livro-razão soma tudo, então uma retirada precisa ser negativa para reduzir
 * a posição. Antes isso dependia de a pessoa digitar "-14", e digitar "14"
 * produzia o oposto do pretendido em silêncio: a retirada somava à exposição e
 * o projeto parecia ter mais dinheiro depois do saque.
 *
 * Exigir o sinal era pedir que a pessoa soubesse a convenção interna do banco.
 * Agora o tipo decide, e o valor digitado é sempre a quantia.
 *
 * A função é idempotente de propósito (`-abs` de um negativo segue negativo):
 * aplicá-la duas vezes, no cliente e no servidor, dá o mesmo resultado.
 */
export function aplicarSinalDoTipo(type: string, valor: Cents): Cents {
  switch (direcaoDoTipo(type)) {
    case "saida":
      return cents(-Math.abs(valor));
    case "entrada":
      return cents(Math.abs(valor));
    default:
      return valor;
  }
}

// ----------------------------------------------------------- resultado

/**
 * Resultado de um recorte qualquer: geral, projeto, conta ou par.
 *
 * Existe como função porque a fórmula já morou em dois lugares e eles
 * divergiram: `summarizeFinancials` somava o retirado de volta e os cartões de
 * projeto e conta faziam apenas `exposição − aportado`. O mesmo projeto exibia
 * resultados diferentes conforme a tela.
 *
 * O retirado entra somado, e é a parte que engana: ele já reduziu a exposição
 * (é negativo no razão), mas o dinheiro sacado continua sendo de quem sacou.
 * Aportar 20, perder 6 e sacar 14 zera a posição sem ser prejuízo de 20: o
 * prejuízo é 6, que é exatamente o que se perdeu.
 */
export function resultadoLiquido(params: {
  exposicao: Cents;
  aportado: Cents;
  retirado: Cents;
  airdrops?: Cents;
  taxas?: Cents;
}): Cents {
  const { exposicao, aportado, retirado, airdrops = ZERO, taxas = ZERO } = params;
  return cents(
    exposicao + Math.abs(retirado) + airdrops - aportado - Math.abs(taxas),
  );
}

export function sumOfType(movements: MovementRow[], type: string): Cents {
  return cents(
    movements
      .filter((m) => m.type === type)
      .reduce<number>((acc, m) => acc + fromDbNumeric(m.amountUsd), 0),
  );
}

/** Soma em dólar dos movimentos de caixa, por par. */
export function netFlowByPair(movements: MovementRow[]): Map<PairKey, Cents> {
  const result = new Map<PairKey, Cents>();
  for (const mov of movements) {
    if (!isCashType(mov.type)) continue;
    const key = pairKey(mov.projectId, mov.accountId);
    result.set(key, addCents(result.get(key) ?? ZERO, fromDbNumeric(mov.amountUsd)));
  }
  return result;
}

// ------------------------------------------------------------------- tokens

/** Quantidade líquida de cada token, por par. Chave: `par::SÍMBOLO`. */
export type TokenPositionKey = string;

export type TokenPosition = {
  symbol: string;
  /** Quantidade acumulada. String para não perder precisão de token. */
  amount: number;
  /** Dólar efetivamente aportado nesta posição, na data de cada lançamento. */
  investedUsd: Cents;
};

export function tokenPositionsByPair(
  movements: MovementRow[],
): Map<PairKey, Map<string, TokenPosition>> {
  const result = new Map<PairKey, Map<string, TokenPosition>>();

  for (const mov of movements) {
    if (!isCashType(mov.type)) continue;
    if (!mov.tokenSymbol || !mov.tokenAmount) continue;

    const key = pairKey(mov.projectId, mov.accountId);
    const simbolo = mov.tokenSymbol.toUpperCase();
    const porToken = result.get(key) ?? new Map<string, TokenPosition>();
    const atual = porToken.get(simbolo) ?? {
      symbol: simbolo,
      amount: 0,
      investedUsd: ZERO,
    };

    porToken.set(simbolo, {
      symbol: simbolo,
      amount: atual.amount + Number(mov.tokenAmount),
      investedUsd: addCents(atual.investedUsd, fromDbNumeric(mov.amountUsd)),
    });
    result.set(key, porToken);
  }
  return result;
}

export function priceMap(prices: TokenPriceRow[]): Map<string, Cents> {
  return new Map(
    prices.map((p) => [p.symbol.toUpperCase(), fromDbNumeric(p.priceUsd)]),
  );
}

export type PairExposure = {
  value: Cents;
  /** Parte do valor que veio de posição em token revalorizada. */
  tokenValue: Cents;
  /** Tokens sem cotação informada: a interface avisa em vez de fingir preço. */
  semCotacao: string[];
};

/**
 * Exposição de um par projeto×conta.
 *
 * Lançamentos em dólar entram pelo valor lançado. Lançamentos em token são
 * revalorizados pela cotação atual: é isso que revela ganho ou perda no preço
 * do token, e não apenas o que foi aportado.
 *
 * Sem cotação informada para um token, o valor em dólar do aporte é mantido:
 * subestimar seria tão errado quanto inventar preço: e o símbolo é reportado
 * para que a interface peça a atualização.
 */
export function exposureForPair(
  key: PairKey,
  netFlow: Map<PairKey, Cents>,
  positions: Map<PairKey, Map<string, TokenPosition>>,
  prices: Map<string, Cents>,
): PairExposure {
  const totalUsd = netFlow.get(key) ?? ZERO;
  const doPar = positions.get(key);

  if (!doPar || doPar.size === 0) {
    return { value: totalUsd, tokenValue: ZERO, semCotacao: [] };
  }

  let investidoEmToken = ZERO;
  let valorAtualToken = ZERO;
  const semCotacao: string[] = [];

  for (const posicao of doPar.values()) {
    investidoEmToken = addCents(investidoEmToken, posicao.investedUsd);
    const preco = prices.get(posicao.symbol);
    if (preco === undefined) {
      semCotacao.push(posicao.symbol);
      valorAtualToken = addCents(valorAtualToken, posicao.investedUsd);
      continue;
    }
    valorAtualToken = addCents(valorAtualToken, cents(Math.round(posicao.amount * preco)));
  }

  // Troca a parcela aportada em token pela parcela revalorizada.
  const emDolar = cents(totalUsd - investidoEmToken);
  return {
    value: addCents(emDolar, valorAtualToken),
    tokenValue: valorAtualToken,
    semCotacao,
  };
}

export type SummaryInput = {
  movements: MovementRow[];
  prices: TokenPriceRow[];
  /** Pares ativos. Um par pode existir sem movimento (conta recém-vinculada). */
  pairs: { projectId: string; accountId: string }[];
  airdropsUsd?: string[];
};

export function summarizeFinancials(input: SummaryInput): FinancialSummary & {
  tokensSemCotacao: string[];
} {
  const { movements, prices, pairs, airdropsUsd = [] } = input;

  const aportado = sumOfType(movements, "deposit");
  const retirado = sumOfType(movements, "withdrawal");
  const taxas = sumOfType(movements, "fee_gas");
  const pnlTrades = sumOfType(movements, "trade_pnl");
  const rendimentos = sumOfType(movements, "yield");
  const airdrops = cents(
    airdropsUsd.reduce<number>((acc, v) => acc + fromDbNumeric(v), 0),
  );

  const netMap = netFlowByPair(movements);
  const posMap = tokenPositionsByPair(movements);
  const precos = priceMap(prices);

  let exposicao = ZERO;
  const semCotacao = new Set<string>();
  for (const pair of pairs) {
    const exposure = exposureForPair(
      pairKey(pair.projectId, pair.accountId),
      netMap,
      posMap,
      precos,
    );
    exposicao = addCents(exposicao, exposure.value);
    for (const simbolo of exposure.semCotacao) semCotacao.add(simbolo);
  }

  const resultado = resultadoLiquido({
    exposicao,
    aportado,
    retirado,
    airdrops,
    taxas,
  });

  return {
    aportado,
    retirado,
    taxas,
    pnlTrades,
    rendimentos,
    airdrops,
    exposicao,
    resultado,
    roi: percentOf(resultado, aportado),
    tokensSemCotacao: [...semCotacao],
  };
}
