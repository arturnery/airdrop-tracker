import { describe, expect, it } from "vitest";

import {
  formatarPercentual,
  formatarPreco,
  formatarR,
  incoerencias,
  lerPreco,
  placarDosSinais,
  precoDaSaida,
  resultadoDoSinal,
  riscoRetorno,
  type Sinal,
} from "@/lib/sinais";
import { fecharSinalSchema, sinalSchema } from "@/lib/validators";

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

const compra: Sinal = {
  id: "s1",
  ativo: "BTC/USDT",
  direcao: "compra",
  entrada: "100",
  entradaAte: null,
  stop: "90",
  alvos: ["120", "130"],
  timeframe: null,
  observacao: null,
  status: "aberto",
  publicadoEm: "2026-10-20T12:00:00.000Z",
  discordEnviado: false,
};
const venda: Sinal = { ...compra, id: "s2", direcao: "venda", stop: "110", alvos: ["80"] };

describe("resultadoDoSinal", () => {
  it("compra que bate o alvo dá lucro, em % e em R", () => {
    expect(resultadoDoSinal(compra, "120")).toEqual({ desfecho: "lucro", percentual: 20, r: 2 });
  });

  it("compra que stopa perde exatamente 1R", () => {
    expect(resultadoDoSinal(compra, "90")).toEqual({ desfecho: "prejuizo", percentual: -10, r: -1 });
  });

  it("na venda o sinal se inverte: cair é lucro, subir é prejuízo", () => {
    expect(resultadoDoSinal(venda, "80")).toEqual({ desfecho: "lucro", percentual: 20, r: 2 });
    expect(resultadoDoSinal(venda, "110")).toEqual({ desfecho: "prejuizo", percentual: -10, r: -1 });
  });

  it("sair na entrada é empate, sem ruído de ponto flutuante", () => {
    expect(resultadoDoSinal({ ...compra, entrada: "0.1", stop: "0.09" }, "0.1")?.desfecho).toBe("empate");
  });

  it("com zona de entrada, mede do meio da zona, como o risco/retorno", () => {
    const zona = { ...compra, entrada: "95", entradaAte: "105" };
    expect(resultadoDoSinal(zona, "120")?.percentual).toBe(20);
  });
});

describe("precoDaSaida", () => {
  it("alvo e stop vêm do sinal; o manual, do que foi digitado", () => {
    expect(precoDaSaida(compra, "alvo2", null)).toBe("130");
    expect(precoDaSaida(compra, "stop", "999")).toBe("90");
    expect(precoDaSaida(compra, "manual", "115")).toBe("115");
  });

  it("alvo que o sinal não tem não vira preço", () => {
    expect(precoDaSaida(compra, "alvo3", null)).toBeNull();
  });
});

describe("placarDosSinais", () => {
  const fechado = (s: Sinal, preco: string): Sinal => ({ ...s, status: "encerrado", saida: "manual", precoSaida: preco });

  it("conta acertos e soma R e %, ignorando abertos e não acionados", () => {
    const placar = placarDosSinais([
      fechado(compra, "120"),
      fechado(venda, "110"),
      fechado({ ...compra, id: "s3" }, "100"),
      { ...compra, id: "s4", status: "cancelado" },
      { ...compra, id: "s5" },
    ]);
    expect(placar).toMatchObject({ fechados: 3, lucros: 1, prejuizos: 1, empates: 1, somaR: 1, somaPercentual: 10 });
    expect(placar.taxaDeAcerto).toBeCloseTo(33.33, 1);
  });

  it("o total é a soma das linhas que os cards mostram", () => {
    const sinais = [fechado(compra, "113.7"), fechado(venda, "93.1"), fechado(compra, "91.2")];
    const linhas = sinais.map((s) => resultadoDoSinal(s, s.precoSaida!)!);
    const placar = placarDosSinais(sinais);
    expect(placar.somaR).toBeCloseTo(linhas.reduce((t, l) => t + l.r!, 0), 9);
    expect(placar.somaPercentual).toBeCloseTo(linhas.reduce((t, l) => t + l.percentual, 0), 9);
  });

  it("sem fechado, a taxa de acerto não é 0%, é ausente", () => {
    expect(placarDosSinais([compra]).taxaDeAcerto).toBeNull();
  });
});

describe("fecharSinalSchema", () => {
  const id = "0b9f6a4e-6a8d-4f62-9d3c-1d2a3b4c5d6e";

  it("saída manual exige preço", () => {
    const r = fecharSinalSchema.safeParse({ id, fechamento: "manual", precoManual: "" });
    expect(r.error?.issues[0]?.path).toEqual(["precoManual"]);
  });

  it("nas outras saídas, o preço digitado é descartado: vem do sinal", () => {
    expect(fecharSinalSchema.parse({ id, fechamento: "alvo1", precoManual: "999" }).precoManual).toBeNull();
  });

  it("normaliza o preço manual", () => {
    expect(fecharSinalSchema.parse({ id, fechamento: "manual", precoManual: "64.300,5" }).precoManual).toBe("64300.5");
  });
});

describe("formatação do resultado", () => {
  it("leva sinal sempre, para lucro e prejuízo não se confundirem", () => {
    expect(formatarPercentual(2.4867)).toBe("+2,49%");
    expect(formatarPercentual(-10)).toBe("-10%");
    expect(formatarR(2.14)).toBe("+2,1R");
    expect(formatarR(-1)).toBe("-1R");
    expect(formatarR(0)).toBe("0R");
  });
});
