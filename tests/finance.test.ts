import { describe, expect, it } from "vitest";

import {
  exposureForPair,
  isCashType,
  netFlowByPair,
  pairKey,
  priceMap,
  summarizeFinancials,
  sumOfType,
  tokenPositionsByPair,
  type MovementRow,
  type TokenPriceRow,
} from "@/lib/finance";
import { toDbNumeric } from "@/lib/money";

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
