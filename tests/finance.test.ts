import { describe, expect, it } from "vitest";

import {
  aplicarSinalDoTipo,
  capitalDepositado,
  exposureForPair,
  isCashType,
  resultadoLiquido,
  netFlowByPair,
  pairKey,
  priceMap,
  summarizeFinancials,
  sumOfType,
  tokenPositionsByPair,
  type MovementRow,
  type TokenPriceRow,
} from "@/lib/finance";
import { cents, toDbNumeric } from "@/lib/money";

const mov = (
  projectId: string,
  accountId: string,
  type: string,
  amountUsd: string,
  token?: { symbol: string; amount: string },
): MovementRow => ({
  projectId,
  accountId,
  type,
  amountUsd,
  tokenSymbol: token?.symbol ?? null,
  tokenAmount: token?.amount ?? null,
});

const preco = (symbol: string, priceUsd: string): TokenPriceRow => ({
  symbol,
  priceUsd,
});

const KEY = pairKey("p1", "a1");
const expor = (movs: MovementRow[], precos: TokenPriceRow[] = []) =>
  exposureForPair(
    KEY,
    netFlowByPair(movs),
    tokenPositionsByPair(movs),
    priceMap(precos),
  );

describe("tipos de caixa", () => {
  it("volume operado e taxa ficam fora do saldo", () => {
    expect(isCashType("deposit")).toBe(true);
    expect(isCashType("yield")).toBe(true);
    expect(isCashType("trade_pnl")).toBe(true);
    expect(isCashType("withdrawal")).toBe(true);
    // Volume é atividade; taxa sai do bolso, não da posição.
    expect(isCashType("volume_traded")).toBe(false);
    expect(isCashType("fee_gas")).toBe(false);
  });
});

describe("saldo como soma de lançamentos", () => {
  it("acumula depósito, rendimento e perda", () => {
    const saldo = expor([
      mov("p1", "a1", "deposit", "100.00"),
      mov("p1", "a1", "yield", "1.00"),
      mov("p1", "a1", "trade_pnl", "-5.00"),
    ]);
    expect(toDbNumeric(saldo.value)).toBe("96.00");
  });

  it("desconta retirada", () => {
    const saldo = expor([
      mov("p1", "a1", "deposit", "100.00"),
      mov("p1", "a1", "withdrawal", "-30.00"),
    ]);
    expect(toDbNumeric(saldo.value)).toBe("70.00");
  });

  it("ignora volume operado", () => {
    const saldo = expor([
      mov("p1", "a1", "deposit", "20.00"),
      mov("p1", "a1", "volume_traded", "9999.00"),
    ]);
    expect(toDbNumeric(saldo.value)).toBe("20.00");
  });

  it("par sem lançamento nenhum vale zero", () => {
    expect(toDbNumeric(expor([]).value)).toBe("0.00");
  });
});

describe("posição em token", () => {
  it("revaloriza pela cotação atual", () => {
    // 1 SOL comprado a $180, valendo $195 hoje.
    const saldo = expor(
      [mov("p1", "a1", "deposit", "180.00", { symbol: "SOL", amount: "1" })],
      [preco("SOL", "195.00")],
    );
    expect(toDbNumeric(saldo.value)).toBe("195.00");
    expect(toDbNumeric(saldo.tokenValue)).toBe("195.00");
  });

  it("mostra perda quando o token cai", () => {
    const saldo = expor(
      [mov("p1", "a1", "deposit", "180.00", { symbol: "SOL", amount: "1" })],
      [preco("SOL", "150.00")],
    );
    expect(toDbNumeric(saldo.value)).toBe("150.00");
  });

  it("acumula quantidade de aportes sucessivos", () => {
    const saldo = expor(
      [
        mov("p1", "a1", "deposit", "180.00", { symbol: "SOL", amount: "1" }),
        mov("p1", "a1", "deposit", "100.00", { symbol: "SOL", amount: "0.5" }),
      ],
      [preco("SOL", "200.00")],
    );
    // 1,5 SOL × $200
    expect(toDbNumeric(saldo.value)).toBe("300.00");
  });

  it("soma parte em dólar com parte em token", () => {
    const saldo = expor(
      [
        mov("p1", "a1", "deposit", "50.00"),
        mov("p1", "a1", "deposit", "180.00", { symbol: "SOL", amount: "1" }),
      ],
      [preco("SOL", "195.00")],
    );
    // 50 em dólar + 195 do SOL revalorizado
    expect(toDbNumeric(saldo.value)).toBe("245.00");
  });

  it("sem cotação, mantém o valor aportado e reporta o símbolo", () => {
    const saldo = expor([
      mov("p1", "a1", "deposit", "180.00", { symbol: "SOL", amount: "1" }),
    ]);
    expect(toDbNumeric(saldo.value)).toBe("180.00");
    expect(saldo.semCotacao).toEqual(["SOL"]);
  });

  it("normaliza o símbolo para maiúsculo", () => {
    const saldo = expor(
      [mov("p1", "a1", "deposit", "180.00", { symbol: "sol", amount: "1" })],
      [preco("SOL", "195.00")],
    );
    expect(toDbNumeric(saldo.value)).toBe("195.00");
  });

  it("separa posições de tokens diferentes", () => {
    const posicoes = tokenPositionsByPair([
      mov("p1", "a1", "deposit", "180.00", { symbol: "SOL", amount: "1" }),
      mov("p1", "a1", "deposit", "50.00", { symbol: "USDC", amount: "50" }),
    ]);
    expect(posicoes.get(KEY)?.size).toBe(2);
  });
});

describe("sumOfType", () => {
  it("soma apenas o tipo pedido", () => {
    const movs = [
      mov("p1", "a1", "deposit", "20.00"),
      mov("p1", "a1", "deposit", "9.00"),
      mov("p1", "a1", "yield", "1.50"),
    ];
    expect(toDbNumeric(sumOfType(movs, "deposit"))).toBe("29.00");
    expect(toDbNumeric(sumOfType(movs, "yield"))).toBe("1.50");
  });
});

describe("summarizeFinancials", () => {
  const pares = [{ projectId: "p1", accountId: "a1" }];

  it("separa aportado de rendimento no resultado", () => {
    const resumo = summarizeFinancials({
      movements: [
        mov("p1", "a1", "deposit", "100.00"),
        mov("p1", "a1", "yield", "5.00"),
      ],
      prices: [],
      pairs: pares,
    });
    expect(toDbNumeric(resumo.aportado)).toBe("100.00");
    expect(toDbNumeric(resumo.rendimentos)).toBe("5.00");
    expect(toDbNumeric(resumo.exposicao)).toBe("105.00");
    expect(toDbNumeric(resumo.resultado)).toBe("5.00");
  });

  /**
   * O dinheiro sacado saiu da plataforma mas continua sendo do usuário.
   * Aportar 100 e sacar 30 deixa 70 na plataforma e 30 no bolso: resultado
   * zero, não prejuízo de 30.
   */
  it("não conta retirada como prejuízo", () => {
    const resumo = summarizeFinancials({
      movements: [
        mov("p1", "a1", "deposit", "100.00"),
        mov("p1", "a1", "withdrawal", "-30.00"),
      ],
      prices: [],
      pairs: pares,
    });
    expect(toDbNumeric(resumo.exposicao)).toBe("70.00");
    expect(toDbNumeric(resumo.resultado)).toBe("0.00");
  });

  it("desconta taxas do resultado sem tirar do saldo", () => {
    const resumo = summarizeFinancials({
      movements: [
        mov("p1", "a1", "deposit", "100.00"),
        mov("p1", "a1", "fee_gas", "-4.00"),
      ],
      prices: [],
      pairs: pares,
    });
    // Gas sai do bolso, não da posição na plataforma.
    expect(toDbNumeric(resumo.exposicao)).toBe("100.00");
    expect(toDbNumeric(resumo.resultado)).toBe("-4.00");
  });

  it("valorização do token entra no resultado", () => {
    const resumo = summarizeFinancials({
      movements: [
        mov("p1", "a1", "deposit", "180.00", { symbol: "SOL", amount: "1" }),
      ],
      prices: [preco("SOL", "195.00")],
      pairs: pares,
    });
    expect(toDbNumeric(resumo.resultado)).toBe("15.00");
    expect(resumo.roi).toBe(8.3);
  });

  it("reporta tokens sem cotação", () => {
    const resumo = summarizeFinancials({
      movements: [
        mov("p1", "a1", "deposit", "180.00", { symbol: "SOL", amount: "1" }),
        mov("p1", "a1", "deposit", "50.00", { symbol: "ARB", amount: "40" }),
      ],
      prices: [preco("SOL", "195.00")],
      pairs: pares,
    });
    expect(resumo.tokensSemCotacao).toEqual(["ARB"]);
  });

  it("soma airdrops recebidos", () => {
    const resumo = summarizeFinancials({
      movements: [mov("p1", "a1", "deposit", "20.00")],
      prices: [],
      pairs: pares,
      airdropsUsd: ["150.00"],
    });
    expect(toDbNumeric(resumo.resultado)).toBe("150.00");
  });

  it("devolve ROI nulo sem aporte em vez de Infinity", () => {
    const resumo = summarizeFinancials({
      movements: [],
      prices: [],
      pairs: pares,
    });
    expect(resumo.roi).toBeNull();
  });
});

describe("preço de entrada derivado", () => {
  it("dividir valor por quantidade dá o preço unitário", () => {
    const posicoes = tokenPositionsByPair([
      // $100 por 2 SOL: entrou a $50 cada.
      mov("p1", "a1", "deposit", "100.00", { symbol: "SOL", amount: "2" }),
    ]);
    const sol = posicoes.get(KEY)!.get("SOL")!;
    expect(toDbNumeric(sol.investedUsd)).toBe("100.00");
    expect(sol.amount).toBe(2);
    // 10000 centavos / 2 = 5000 centavos
    expect(Math.round(sol.investedUsd / sol.amount)).toBe(5000);
  });

  it("aportes a preços diferentes viram preço médio", () => {
    const posicoes = tokenPositionsByPair([
      mov("p1", "a1", "deposit", "100.00", { symbol: "SOL", amount: "2" }),
      mov("p1", "a1", "deposit", "300.00", { symbol: "SOL", amount: "2" }),
    ]);
    const sol = posicoes.get(KEY)!.get("SOL")!;
    // $400 por 4 SOL: média de $100, entre os $50 e os $150 pagos.
    expect(toDbNumeric(sol.investedUsd)).toBe("400.00");
    expect(sol.amount).toBe(4);
    expect(Math.round(sol.investedUsd / sol.amount)).toBe(10000);
  });
});

describe("sinal pelo tipo do lançamento", () => {
  it("retirada e taxa viram negativas mesmo digitadas sem sinal", () => {
    expect(aplicarSinalDoTipo("withdrawal", cents(1400))).toBe(-1400);
    expect(aplicarSinalDoTipo("fee_gas", cents(250))).toBe(-250);
  });

  it("já negativas continuam negativas: aplicar duas vezes não alterna", () => {
    const uma = aplicarSinalDoTipo("withdrawal", cents(-1400));
    expect(uma).toBe(-1400);
    expect(aplicarSinalDoTipo("withdrawal", uma)).toBe(-1400);
  });

  it("depósito e rendimento não ficam negativos por engano", () => {
    expect(aplicarSinalDoTipo("deposit", cents(-2000))).toBe(2000);
    expect(aplicarSinalDoTipo("yield", cents(150))).toBe(150);
  });

  it("resultado de trade preserva o sinal: pode ser lucro ou prejuízo", () => {
    expect(aplicarSinalDoTipo("trade_pnl", cents(-600))).toBe(-600);
    expect(aplicarSinalDoTipo("trade_pnl", cents(600))).toBe(600);
  });
});

describe("resultadoLiquido", () => {
  /*
   * O caso relatado em uso real: depositar 20, perder 6 em trade e sacar os 14
   * restantes zera a posição. Antes os cartões mostravam -20 (todo o aportado
   * como perda), porque a fórmula deles ignorava o saque.
   */
  it("sacar o que sobrou não vira prejuízo do valor aportado", () => {
    expect(
      resultadoLiquido({
        exposicao: cents(0),
        aportado: cents(2000),
        retirado: cents(-1400),
      }),
    ).toBe(-600);
  });

  it("aportar e sacar sem ganho nem perda dá resultado zero", () => {
    expect(
      resultadoLiquido({
        exposicao: cents(7000),
        aportado: cents(10000),
        retirado: cents(-3000),
      }),
    ).toBe(0);
  });

  it("taxas entram como custo qualquer que seja o sinal gravado", () => {
    const comNegativa = resultadoLiquido({
      exposicao: cents(1000),
      aportado: cents(1000),
      retirado: cents(0),
      taxas: cents(-200),
    });
    expect(comNegativa).toBe(-200);
    expect(
      resultadoLiquido({
        exposicao: cents(1000),
        aportado: cents(1000),
        retirado: cents(0),
        taxas: cents(200),
      }),
    ).toBe(comNegativa);
  });

  it("airdrop recebido entra como ganho", () => {
    expect(
      resultadoLiquido({
        exposicao: cents(0),
        aportado: cents(5000),
        retirado: cents(0),
        airdrops: cents(8000),
      }),
    ).toBe(3000);
  });
});

describe("capitalDepositado", () => {
  /*
   * O caso que motivou a mudança: depositar 500, usar o protocolo por um mês e
   * sacar tudo. O total depositado seguiria exibindo 500 para sempre, como se
   * ainda houvesse dinheiro parado ali.
   */
  it("sacar tudo zera o capital depositado", () => {
    expect(
      capitalDepositado({ aportado: cents(50000), retirado: cents(-50000) }),
    ).toBe(0);
  });

  it("posição aberta mostra o que ainda é dinheiro próprio", () => {
    expect(
      capitalDepositado({ aportado: cents(4000), retirado: cents(-2600) }),
    ).toBe(1400);
  });

  it("sem retirada, é o próprio depositado", () => {
    expect(capitalDepositado({ aportado: cents(2000), retirado: cents(0) })).toBe(
      2000,
    );
  });

  /*
   * Sacar mais do que se depositou significa lucro já realizado. Isso é zero
   * capital próprio parado, não capital negativo: o ganho pertence ao resultado.
   */
  it("retirar mais do que depositou não vira capital negativo", () => {
    expect(
      capitalDepositado({ aportado: cents(10000), retirado: cents(-15000) }),
    ).toBe(0);
  });

  it("o sinal gravado na retirada não altera o resultado", () => {
    expect(
      capitalDepositado({ aportado: cents(4000), retirado: cents(2600) }),
    ).toBe(capitalDepositado({ aportado: cents(4000), retirado: cents(-2600) }));
  });
});

describe("ROI sobre o capital depositado", () => {
  const resumo = (movs: MovementRow[]) =>
    summarizeFinancials({
      movements: movs,
      prices: [],
      pairs: [{ projectId: "p1", accountId: "c1" }],
    });

  it("posição aberta: percentual sobre o que ainda está lá", () => {
    // Depositou 100, rendeu 20 e não sacou nada.
    const r = resumo([
      mov("p1", "c1", "deposit", "100.00"),
      mov("p1", "c1", "yield", "20.00"),
    ]);
    expect(r.capitalDepositado).toBe(10000);
    expect(r.resultado).toBe(2000);
    expect(r.roi).toBe(20);
  });

  /*
   * O caso que motivou a mudança: sacar tudo e esperar o airdrop. Não há
   * capital parado, então não existe retorno sobre capital, e a tela mostra
   * apenas o resultado em dólar.
   */
  it("sacou tudo: sem percentual, mas com resultado", () => {
    const r = resumo([
      mov("p1", "c1", "deposit", "50.00"),
      mov("p1", "c1", "withdrawal", "-30.00"),
      mov("p1", "c1", "withdrawal", "-20.00"),
    ]);
    expect(r.capitalDepositado).toBe(0);
    expect(r.resultado).toBe(0);
    expect(r.roi).toBeNull();
  });

  /*
   * Depositar 50, render 10 e sacar os 60 é lucro de 10 com a posição zerada.
   * Se o percentual saísse do líquido negativo (50 - 60 = -10), daria -100%:
   * exatamente o oposto do que aconteceu. Por isso o capital nunca é negativo
   * e o ROI não existe aqui.
   */
  it("sacar mais do que depositou não vira ROI negativo", () => {
    const r = resumo([
      mov("p1", "c1", "deposit", "50.00"),
      mov("p1", "c1", "yield", "10.00"),
      mov("p1", "c1", "withdrawal", "-60.00"),
    ]);
    expect(r.resultado).toBe(1000);
    expect(r.capitalDepositado).toBe(0);
    expect(r.roi).toBeNull();
  });

  /*
   * O mesmo saque sem o rendimento lançado. O razão só sabe o que foi
   * registrado: sem o lançamento de onde vieram os 10 a mais, não há ganho a
   * reconhecer, e a exposição fica negativa denunciando a inconsistência.
   */
  it("saque maior que o razão sem ganho lançado não inventa lucro", () => {
    const r = resumo([
      mov("p1", "c1", "deposit", "50.00"),
      mov("p1", "c1", "withdrawal", "-60.00"),
    ]);
    expect(r.exposicao).toBe(-1000);
    expect(r.resultado).toBe(0);
  });

  it("perda com posição ainda aberta dá percentual negativo", () => {
    // Depositou 50, retirou 40, perdeu 10 em trade: sobra 0 de exposição.
    const r = resumo([
      mov("p1", "c1", "deposit", "50.00"),
      mov("p1", "c1", "withdrawal", "-40.00"),
      mov("p1", "c1", "trade_pnl", "-10.00"),
    ]);
    expect(r.capitalDepositado).toBe(1000);
    expect(r.resultado).toBe(-1000);
    expect(r.roi).toBe(-100);
  });
});

describe("tipo Outro entra no caixa", () => {
  /*
   * Nasceu como anotação sem efeito e virou armadilha: um valor lançado ali
   * não mexia em nada, o que parecia falha de gravação.
   */
  it("é tratado como movimento de caixa", () => {
    expect(isCashType("other")).toBe(true);
  });

  it("reduz a exposição quando negativo", () => {
    const r = summarizeFinancials({
      movements: [
        mov("p1", "c1", "deposit", "100.00"),
        mov("p1", "c1", "other", "-75.00"),
      ],
      prices: [],
      pairs: [{ projectId: "p1", accountId: "c1" }],
    });
    expect(r.exposicao).toBe(2500);
    expect(r.resultado).toBe(-7500);
  });

  it("volume operado continua fora do caixa: é atividade, não dinheiro", () => {
    expect(isCashType("volume_traded")).toBe(false);
    const r = summarizeFinancials({
      movements: [
        mov("p1", "c1", "deposit", "100.00"),
        mov("p1", "c1", "volume_traded", "5000.00"),
      ],
      prices: [],
      pairs: [{ projectId: "p1", accountId: "c1" }],
    });
    expect(r.exposicao).toBe(10000);
  });
})

/**
 * A simetria do resultado de trade.
 *
 * Se lucro aumenta o saldo, prejuízo tem de diminuí-lo na mesma medida: o
 * dinheiro perdido operando não está mais na plataforma. Escrito depois de eu
 * descrever a regra errado, dizendo que só a retirada tirava dinheiro da
 * exposição. O código já estava certo; o que faltava era isto fixado.
 */
describe("lucro e prejuízo de trade são simétricos no saldo", () => {
  const comTrade = (valor: string) =>
    expor([mov("p1", "a1", "deposit", "100.00"), mov("p1", "a1", "trade_pnl", valor)])
      .value;

  it("lucro soma ao saldo", () => {
    expect(toDbNumeric(comTrade("40.00"))).toBe("140.00");
  });

  it("prejuízo desconta do saldo, na mesma medida", () => {
    expect(toDbNumeric(comTrade("-40.00"))).toBe("60.00");
  });

  it("o desvio para cima e para baixo tem o mesmo tamanho", () => {
    const semTrade = expor([mov("p1", "a1", "deposit", "100.00")]).value;
    const ganho = comTrade("40.00") - semTrade;
    const perda = semTrade - comTrade("-40.00");
    // O valor explícito impede o teste de passar com NaN dos dois lados.
    expect(ganho).toBe(4000);
    expect(perda).toBe(4000);
  });

  it("o sinal digitado é preservado, não forçado", () => {
    // Diferente de retirada, que tem direção conhecida e leva o sinal imposto.
    expect(aplicarSinalDoTipo("trade_pnl", cents(4000))).toBe(4000);
    expect(aplicarSinalDoTipo("trade_pnl", cents(-4000))).toBe(-4000);
    expect(aplicarSinalDoTipo("withdrawal", cents(4000))).toBe(-4000);
  });
});
