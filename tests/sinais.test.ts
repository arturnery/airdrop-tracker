import { describe, expect, it } from "vitest";

import { formatarPreco, incoerencias, lerPreco, riscoRetorno } from "@/lib/sinais";
import { sinalSchema } from "@/lib/validators";

describe("lerPreco", () => {
  it("aceita ponto ou vírgula como decimal", () => {
    expect(lerPreco("64200.5")).toBe("64200.5");
    expect(lerPreco("64200,5")).toBe("64200.5");
  });

  it("com os dois separadores, o último é o decimal", () => {
    expect(lerPreco("64.200,50")).toBe("64200.5");
    expect(lerPreco("64,200.50")).toBe("64200.5");
  });

  it("preço minúsculo de memecoin mantém todas as casas", () => {
    expect(lerPreco("0.00000123")).toBe("0.00000123");
    expect(lerPreco("0,00000123")).toBe("0.00000123");
  });

  it("com um separador só, ele é decimal, mesmo com três dígitos depois", () => {
    expect(lerPreco("0.123")).toBe("0.123");
  });

  it("recusa o que não é preço", () => {
    expect(lerPreco("")).toBeNull();
    expect(lerPreco("abc")).toBeNull();
    expect(lerPreco("-5")).toBeNull();
    expect(lerPreco("0")).toBeNull();
    expect(lerPreco("1.2.3")).toBeNull();
  });

  it("limpa sobra: cifrão, espaços e zeros", () => {
    expect(lerPreco(" $064200.500 ")).toBe("64200.5");
    expect(lerPreco("65000.00")).toBe("65000");
  });
});

describe("incoerencias", () => {
  const compra = { direcao: "compra" as const, entrada: "100", entradaAte: null, stop: "95", alvos: ["110", "120"] };

  it("compra coerente: stop abaixo, alvos acima", () => {
    expect(incoerencias(compra)).toEqual({});
  });

  it("compra com stop acima da entrada é recusada no campo do stop", () => {
    expect(incoerencias({ ...compra, stop: "105" })).toEqual({
      stop: "Numa compra, o stop fica abaixo da entrada.",
    });
  });

  it("aponta qual alvo está do lado errado", () => {
    expect(incoerencias({ ...compra, alvos: ["110", "90"] })).toEqual({
      alvo2: "Numa compra, o alvo fica acima da entrada.",
    });
  });

  it("venda é o espelho", () => {
    const venda = { direcao: "venda" as const, entrada: "100", entradaAte: null, stop: "105", alvos: ["90"] };
    expect(incoerencias(venda)).toEqual({});
    expect(incoerencias({ ...venda, stop: "95" }).stop).toBe("Numa venda, o stop fica acima da entrada.");
  });

  it("com zona de entrada, o stop é comparado à ponta mais desfavorável", () => {
    // Compra entre 100 e 102: stop em 101 está dentro da zona, não abaixo dela.
    expect(incoerencias({ ...compra, entrada: "100", entradaAte: "102", stop: "101" }).stop).toBeDefined();
    expect(incoerencias({ ...compra, entrada: "100", entradaAte: "102", stop: "98" })).toEqual({});
  });
});

describe("riscoRetorno e formatarPreco", () => {
  it("1 de risco para 2 de retorno", () => {
    expect(riscoRetorno({ entrada: "100", entradaAte: null, stop: "95" }, "110")).toBe(2);
  });

  it("usa o meio da zona de entrada", () => {
    expect(riscoRetorno({ entrada: "100", entradaAte: "102", stop: "96" }, "111")).toBe(2);
  });

  it("formata com milhar e preserva as casas", () => {
    expect(formatarPreco("64200.5")).toBe("64,200.5");
    expect(formatarPreco("0.00000123")).toBe("0.00000123");
  });
});

describe("sinalSchema", () => {
  const base = {
    ativo: "btc/usdt",
    direcao: "compra",
    entrada: "64.200,50",
    entradaAte: "",
    stop: "63500",
    alvo1: "65000",
    alvo2: "66000",
    alvo3: "",
    alvo4: "",
    timeframe: "4h",
    observacao: "",
  };

  it("normaliza ativo e preços, e junta os alvos preenchidos", () => {
    const r = sinalSchema.safeParse(base);
    expect(r.success && r.data).toMatchObject({
      ativo: "BTC/USDT",
      entrada: "64200.5",
      entradaAte: null,
      alvos: ["65000", "66000"],
      observacao: null,
    });
  });

  it("incoerência vira erro no campo certo, para a tela marcar onde está", () => {
    const r = sinalSchema.safeParse({ ...base, stop: "65500" });
    expect(r.success).toBe(false);
    expect(r.error?.issues.map((i) => i.path.join("."))).toEqual(["stop"]);
  });

  it("sem o primeiro alvo, recusa", () => {
    const r = sinalSchema.safeParse({ ...base, alvo1: "" });
    expect(r.error?.issues[0]?.path).toEqual(["alvo1"]);
  });

  it("é idempotente: validar a saída de novo dá o mesmo", () => {
    const primeira = sinalSchema.parse(base);
    const [alvo1, alvo2 = "", alvo3 = "", alvo4 = ""] = primeira.alvos;
    const segunda = sinalSchema.parse({
      ...primeira,
      entradaAte: primeira.entradaAte ?? "",
      timeframe: primeira.timeframe ?? "",
      observacao: primeira.observacao ?? "",
      alvo1,
      alvo2,
      alvo3,
      alvo4,
    });
    expect(segunda).toEqual(primeira);
  });
});
