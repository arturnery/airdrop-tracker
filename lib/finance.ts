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
 * `volume_traded` fica de fora: é métrica de atividade, não de caixa, e somá-lo
 * inflaria o capital. `fee_gas` também fica de fora do saldo porque sai do
 * bolso, não da posição; entra no resultado como custo (§5).
 *
 * `trade_pnl` **saiu daqui**, a pedido de quem usa. Ele estava no saldo pela
 * lógica de que lucrar num trade deixa mais dinheiro na plataforma, e a lógica
 * está certa e desencontrada do jeito de trabalhar: o saldo real é conferido na
 * própria corretora e lançado à parte, então somar o resultado do trade fazia
 * a conta contar o mesmo ganho duas vezes. Agora ele move só o resultado, como
 * `fee_gas` já fazia, e o par dos dois é o custo e o ganho da operação.
 *
 * `other` **entra**. Ele nasceu como anotação sem efeito, e isso se mostrou uma
 * armadilha em uso real: uma perda de US$ 75 registrada ali não mexia em número
 * nenhum, o que pareceu falha de gravação e levou ao lançamento duplicado. Um
 * campo que aceita valor com sinal e o ignora não tem defesa: se a pessoa
 * informou uma quantia, ela conta.
 */
const CASH_TYPES = ["deposit", "withdrawal", "yield", "other"] as const;

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

/**
 * Os tipos de lançamento, com o rótulo que a pessoa lê.
 *
 * Ficam aqui, e não dentro do formulário, porque três lugares precisam da mesma
 * lista: as opções do select, o título do diálogo quando o tipo já vem
 * escolhido pelo botão da seção, e a legenda do histórico. Com a lista dentro
 * do formulário, "Volume operado" virava "volume_traded" nos outros dois.
 */
export const TIPOS_LANCAMENTO = [
  { valor: "deposit", rotulo: "Depósito" },
  { valor: "withdrawal", rotulo: "Retirada" },
  { valor: "yield", rotulo: "Rendimento" },
  { valor: "trade_pnl", rotulo: "Resultado de trade" },
  { valor: "fee_gas", rotulo: "Taxa / gas" },
  { valor: "volume_traded", rotulo: "Volume operado" },
  { valor: "other", rotulo: "Outro" },
] as const;

export function rotuloDoTipo(type: string): string | null {
  return TIPOS_LANCAMENTO.find((t) => t.valor === type)?.rotulo ?? null;
}

/**
 * O que acontece com o número quando este tipo é lançado.
 *
 * Existe para a tela poder dizer isso antes de salvar. A ausência dessa
 * informação já custou caro: "Outro" não alterava nada, e a falta de efeito
 * foi lida como falha de gravação.
 */
export function efeitoDoTipo(type: string): string {
  if (type === "volume_traded") {
    return "Registra atividade: não entra no saldo nem no resultado.";
  }
  if (type === "fee_gas") {
    return "Sai do bolso: desconta do resultado, sem mexer na posição.";
  }
  if (type === "trade_pnl") {
    return "Entra só no resultado: o saldo você confere na plataforma.";
  }
  return "Entra no saldo do projeto e no resultado.";
}

// ----------------------------------------------------------- resultado

/**
 * Capital que ainda é dinheiro próprio dentro da posição: depósitos menos
 * retiradas.
 *
 * Cuidado com o nome: **não** é o total já depositado na história do projeto.
 * Esse outro número existe e se chama `aportado`, usado só como base do ROI. O
 * que a tela mostra é este, o que está depositado **agora**.
 *
 * Substituiu o total depositado histórico, que continuava exibindo "$500"
 * mesmo depois de a pessoa ter sacado tudo e não ter mais nada no projeto.
 * Em farming de airdrop o capital é de giro, não é consumido: entra, trabalha e
 * volta. O que interessa é quanto ainda está lá.
 *
 * A diferença entre este número e a exposição ganha significado próprio: é o
 * ganho ou a perda acumulados na posição. Empregar 14 e ter 8 de exposição diz,
 * sozinho, que 6 se perderam.
 *
 * Nunca negativo. Retirar mais do que se depositou significa que o lucro já foi
 * sacado e nada mais é capital próprio parado ali: isso é zero depositado, e o
 * ganho aparece no resultado, que é onde ele pertence.
 */
export function capitalDepositado(params: {
  aportado: Cents;
  retirado: Cents;
}): Cents {
  const liquido = params.aportado - Math.abs(params.retirado);
  return cents(Math.max(0, liquido));
}

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
 *
 * Três parcelas entram por fora da exposição, e cada uma por não pertencer ao
 * saldo: airdrop recebido, taxa paga e resultado de trade. `pnl` é o único que
 * **preserva o sinal**, porque trade dá lucro ou prejuízo; os outros dois têm
 * direção conhecida e o `abs` protege de um sinal digitado ao contrário.
 */
export function resultadoLiquido(params: {
  exposicao: Cents;
  aportado: Cents;
  retirado: Cents;
  airdrops?: Cents;
  taxas?: Cents;
  pnl?: Cents;
}): Cents {
  const {
    exposicao,
    aportado,
    retirado,
    airdrops = ZERO,
    taxas = ZERO,
    pnl = ZERO,
  } = params;
  return cents(
    exposicao + Math.abs(retirado) + airdrops + pnl - aportado - Math.abs(taxas),
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
    pnl: pnlTrades,
  });

  const depositado = capitalDepositado({ aportado, retirado });

  return {
    aportado,
    capitalDepositado: depositado,
    retirado,
    taxas,
    pnlTrades,
    rendimentos,
    airdrops,
    exposicao,
    resultado,
    /*
     * Sobre o capital que ainda está depositado, não sobre o total já
     * depositado na história. O total inflava com reciclagem: usar os mesmos
     * $50 em dois projetos somava $100 de base e derrubava o percentual pela
     * metade, sem que nunca houvesse mais de $50 imobilizados.
     *
     * Fica nulo quando não há nada depositado, e a tela mostra só o resultado
     * em dólar: sem capital parado não existe retorno sobre capital.
     */
    roi: percentOf(resultado, depositado),
    tokensSemCotacao: [...semCotacao],
  };
}
