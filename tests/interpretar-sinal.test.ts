import { describe, expect, it } from "vitest";

import { interpretarSinal, montarMensagensSinal } from "@/lib/interpretar-sinal";
import { sinalSchema } from "@/lib/validators";

describe("montarMensagensSinal", () => {
  it("o print vai como imagem na mensagem do usuário, separado das instruções", () => {
    const [sistema, usuario] = montarMensagensSinal("data:image/jpeg;base64,AAAA");
    expect(sistema!.role).toBe("system");
    expect(usuario!.content).toEqual([
      { type: "text", text: "Extraia a operação deste print." },
      { type: "image_url", image_url: { url: "data:image/jpeg;base64,AAAA" } },
    ]);
  });
});

describe("interpretarSinal", () => {
  const certa = {
    ativo: "btcusdt",
    direcao: "long",
    entrada: "64.200,50",
    entrada_ate: null,
    stop: 63500,
    alvos: ["66000", 68000],
    timeframe: "4h",
    observacao: "Parcial no TP1",
    duvida: null,
  };

  it("leitura certa vira os campos do formulário, sem avisos", () => {
    expect(interpretarSinal(certa)).toEqual({
      valores: {
        ativo: "BTCUSDT",
        direcao: "compra",
        entrada: "64200.5",
        entradaAte: "",
        stop: "63500",
        alvos: ["66000", "68000", "", ""],
        timeframe: "4h",
        observacao: "Parcial no TP1",
      },
      avisos: [],
    });
  });

  /*
   * O elo que importa: os valores preenchidos passam pelo schema que o
   * formulário e a Server Action usam. Se o formato divergir, o erro só
   * apareceria na hora de publicar.
   */
  it("o que a sugestão preenche passa no schema do sinal", () => {
    const { valores } = interpretarSinal(certa)!;
    const [alvo1, alvo2, alvo3, alvo4] = valores.alvos;
    expect(sinalSchema.safeParse({ ...valores, alvo1, alvo2, alvo3, alvo4 }).success).toBe(true);
  });

  it("stop do lado errado é avisado, sem descartar a leitura", () => {
    const r = interpretarSinal({ ...certa, stop: "65000" })!;
    expect(r.valores.stop).toBe("65000");
    expect(r.avisos[0]).toMatch(/Numa compra, o stop fica abaixo da entrada\. A leitura do print/);
  });

  it("short vira venda, e a venda coerente não gera aviso", () => {
    const r = interpretarSinal({ ...certa, direcao: "SHORT", stop: "66000", alvos: ["62000"] })!;
    expect(r.valores.direcao).toBe("venda");
    expect(r.avisos).toEqual([]);
  });

  it("preço ilegível vira campo vazio com aviso dizendo qual", () => {
    const r = interpretarSinal({ ...certa, alvos: ["66000", "6S.000"] })!;
    expect(r.valores.alvos).toEqual(["66000", "", "", ""]);
    expect(r.avisos).toContain('Não consegui ler o alvo 2 ("6S.000"): confira no print.');
  });

  it("sem stop, avisa: é o campo que mais importa", () => {
    const r = interpretarSinal({ ...certa, stop: null })!;
    expect(r.avisos).toContain("Não encontrei o stop no print: preencha antes de publicar.");
  });

  it("zona de entrada com as duas pontas iguais vira entrada simples", () => {
    expect(interpretarSinal({ ...certa, entrada: "100", entrada_ate: "100", stop: "95", alvos: ["110"] })!.valores.entradaAte).toBe("");
  });

  it("no máximo quatro alvos", () => {
    const r = interpretarSinal({ ...certa, alvos: ["65000", "66000", "67000", "68000", "69000"] })!;
    expect(r.valores.alvos).toEqual(["65000", "66000", "67000", "68000"]);
  });

  it("a dúvida do modelo vem primeiro", () => {
    const r = interpretarSinal({ ...certa, duvida: "O TP2 está cortado na borda do print." })!;
    expect(r.avisos[0]).toBe("O TP2 está cortado na borda do print.");
  });

  it("resposta sem nada aproveitável é recusada: o print não era de uma operação", () => {
    expect(interpretarSinal({ ativo: null, direcao: null, entrada: null, stop: null, alvos: [] })).toBeNull();
    expect(interpretarSinal("texto solto")).toBeNull();
  });
});

describe("preços como número JSON", () => {
  const base = { ativo: "BTCUSDT", direcao: "compra", entrada: 64200, stop: 63450, alvos: [65800, 67350] };

  it("número vira o preço sem separador nenhum", () => {
    const r = interpretarSinal(base)!;
    expect([r.valores.entrada, r.valores.stop, ...r.valores.alvos]).toEqual(["64200", "63450", "65800", "67350", "", ""]);
  });

  it("número minúsculo sai sem notação científica", () => {
    const r = interpretarSinal({ ...base, ativo: "PEPEUSDT", entrada: 0.00000123, stop: 0.0000011, alvos: [0.0000014] })!;
    expect(r.valores.entrada).toBe("0.00000123");
    expect(r.valores.stop).toBe("0.0000011");
  });
});
