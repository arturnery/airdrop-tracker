import { describe, expect, it } from "vitest";
import {
  MoneyError,
  ZERO,
  addCents,
  cents,
  formatUsd,
  formatUsdCompact,
  fromDbNumeric,
  parseUserInput,
  percentOf,
  semZerosDeSobra,
  sumDbNumeric,
  toDbNumeric,
} from "@/lib/money";

describe("fromDbNumeric", () => {
  it("converte o formato que o Drizzle devolve", () => {
    expect(fromDbNumeric("20.00")).toBe(2000);
    expect(fromDbNumeric("20")).toBe(2000);
    expect(fromDbNumeric("20.5")).toBe(2050);
    expect(fromDbNumeric("0.09")).toBe(9);
  });

  it("preserva negativos (perda em trade)", () => {
    expect(fromDbNumeric("-3.25")).toBe(-325);
  });

  it("trata nulo e vazio como zero", () => {
    expect(fromDbNumeric(null)).toBe(0);
    expect(fromDbNumeric(undefined)).toBe(0);
    expect(fromDbNumeric("")).toBe(0);
  });

  it("rejeita lixo em vez de devolver NaN silencioso", () => {
    expect(() => fromDbNumeric("abc")).toThrow(MoneyError);
    expect(() => fromDbNumeric("1,00")).toThrow(MoneyError);
  });
});

describe("toDbNumeric", () => {
  it("sempre escreve duas casas", () => {
    expect(toDbNumeric(cents(2000))).toBe("20.00");
    expect(toDbNumeric(cents(9))).toBe("0.09");
    expect(toDbNumeric(cents(90))).toBe("0.90");
    expect(toDbNumeric(ZERO)).toBe("0.00");
  });

  it("preserva negativos", () => {
    expect(toDbNumeric(cents(-325))).toBe("-3.25");
    expect(toDbNumeric(cents(-5))).toBe("-0.05");
  });

  it("faz ida e volta sem perder centavo", () => {
    for (const raw of ["0.01", "7.33", "100.00", "-14.07", "999999.99"]) {
      expect(toDbNumeric(fromDbNumeric(raw))).toBe(raw);
    }
  });
});

describe("parseUserInput", () => {
  it("aceita o formato da planilha", () => {
    expect(parseUserInput("$20.00")).toEqual({ ok: true, value: 2000 });
    expect(parseUserInput("$9.00")).toEqual({ ok: true, value: 900 });
    expect(parseUserInput("$7.33")).toEqual({ ok: true, value: 733 });
    expect(parseUserInput("$100.00")).toEqual({ ok: true, value: 10000 });
  });

  it("aceita número solto", () => {
    expect(parseUserInput("20")).toEqual({ ok: true, value: 2000 });
    expect(parseUserInput("  15  ")).toEqual({ ok: true, value: 1500 });
  });

  it("entende decimal em vírgula (teclado BR)", () => {
    expect(parseUserInput("20,50")).toEqual({ ok: true, value: 2050 });
    expect(parseUserInput("1.234,56")).toEqual({ ok: true, value: 123456 });
  });

  it("entende decimal em ponto com milhar em vírgula (US)", () => {
    expect(parseUserInput("1,234.56")).toEqual({ ok: true, value: 123456 });
  });

  it("trata separador de milhar sem decimal", () => {
    expect(parseUserInput("1.234")).toEqual({ ok: true, value: 123400 });
    expect(parseUserInput("1,234")).toEqual({ ok: true, value: 123400 });
  });

  it("aceita negativo em sinal e em parênteses", () => {
    expect(parseUserInput("-9.00")).toEqual({ ok: true, value: -900 });
    expect(parseUserInput("($9.00)")).toEqual({ ok: true, value: -900 });
  });

  it("recusa entrada inválida com mensagem", () => {
    expect(parseUserInput("")).toMatchObject({ ok: false });
    expect(parseUserInput("abc")).toMatchObject({ ok: false });
  });

  it("recusa agrupamento de milhar malformado", () => {
    expect(parseUserInput("1.2.3,4,5")).toMatchObject({ ok: false });
    expect(parseUserInput("1,23,456")).toMatchObject({ ok: false });
    expect(parseUserInput("12.34.56")).toMatchObject({ ok: false });
  });

  it("recusa mais de duas casas em vez de arredondar escondido", () => {
    expect(parseUserInput("10.5555")).toMatchObject({
      ok: false,
      error: "Use no máximo 2 casas decimais.",
    });
  });

  /**
   * "10.005" é ambíguo de verdade: dez mil e cinco (milhar BR) ou dez com três
   * casas decimais. A regra escolhida é milhar, coerente com "1.234", e está
   * documentada em parseUserInput. Este teste existe para travar a decisão:
   * se alguém mudar a heurística, quebra aqui e precisa decidir de novo.
   */
  it("resolve o caso ambíguo de 3 dígitos como milhar", () => {
    expect(parseUserInput("10.005")).toEqual({ ok: true, value: 1_000_500 });
    expect(parseUserInput("10,005")).toEqual({ ok: true, value: 1_000_500 });
  });
});

describe("formatUsd", () => {
  it("formata para exibição", () => {
    expect(formatUsd(cents(2000))).toBe("$20.00");
    expect(formatUsd(cents(733))).toBe("$7.33");
    expect(formatUsd(ZERO)).toBe("$0.00");
  });

  it("formata negativo", () => {
    expect(formatUsd(cents(-900))).toBe("-$9.00");
  });

  it("compacta valores grandes no dashboard", () => {
    expect(formatUsdCompact(cents(2000))).toBe("$20.00");
    expect(formatUsdCompact(cents(1_234_500))).toBe("$12.3K");
  });
});

describe("agregação", () => {
  it("soma sem erro de ponto flutuante", () => {
    // 0.1 + 0.2 !== 0.3 em float; em centavos é exato.
    const total = addCents(cents(10), cents(20));
    expect(total).toBe(30);
    expect(toDbNumeric(total)).toBe("0.30");
  });

  it("soma uma coluna vinda do banco", () => {
    const total = sumDbNumeric(["20.00", "14.00", "9.00", "9.00", "-3.25"]);
    expect(toDbNumeric(total)).toBe("48.75");
  });

  it("ignora nulos na soma", () => {
    expect(sumDbNumeric(["20.00", null, "5.00"])).toBe(2500);
  });
});

describe("percentOf", () => {
  it("calcula ROI com uma casa", () => {
    expect(percentOf(cents(500), cents(2000))).toBe(25);
    expect(percentOf(cents(333), cents(1000))).toBe(33.3);
  });

  it("devolve null sem base em vez de Infinity", () => {
    expect(percentOf(cents(500), ZERO)).toBeNull();
  });
});

describe("guarda de tipo", () => {
  it("recusa centavos fracionados", () => {
    expect(() => cents(10.5)).toThrow(MoneyError);
  });
});

/**
 * `numeric(36, 18)` devolve `3078.000000000000000000`, e era assim que a
 * quantidade de token aparecia: um número certo com cara de erro.
 */
describe("zeros que o Postgres acrescenta", () => {
  it("some com a fração inteira de zeros", () => {
    expect(semZerosDeSobra("3078.000000000000000000")).toBe("3078");
    expect(semZerosDeSobra("1250.00")).toBe("1250");
  });

  it("preserva as casas que dizem alguma coisa", () => {
    expect(semZerosDeSobra("0.18290000")).toBe("0.1829");
    expect(semZerosDeSobra("12.50")).toBe("12.5");
  });

  it("não encosta na parte inteira", () => {
    // O perigo do atalho: `replace(/0+$/)` transformaria 1200 em 12.
    expect(semZerosDeSobra("1200")).toBe("1200");
    expect(semZerosDeSobra("100")).toBe("100");
    expect(semZerosDeSobra("0")).toBe("0");
  });

  it("aguenta valor negativo e zero com casas", () => {
    expect(semZerosDeSobra("-45.500")).toBe("-45.5");
    expect(semZerosDeSobra("0.0000")).toBe("0");
  });
});
