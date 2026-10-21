import { describe, expect, it } from "vitest";

import {
  descreverPeriodo,
  dolar,
  LIMITE_DO_X,
  linkParaPostar,
  perfilDoX,
  postDePontos,
  postDeResultado,
  postDeVolume,
  tamanhoNoX,
} from "@/lib/compartilhar-x";
import { cents } from "@/lib/money";
import { points } from "@/lib/points";

const polymarket = { nome: "Polymarket", perfil: "Polymarket" };

describe("perfilDoX", () => {
  it("lê o @ de x.com e twitter.com", () => {
    expect(perfilDoX("https://x.com/Polymarket")).toBe("Polymarket");
    expect(perfilDoX("https://twitter.com/lighter_xyz/status/1")).toBe("lighter_xyz");
    expect(perfilDoX("https://www.x.com/LevelCripto?s=20")).toBe("LevelCripto");
  });

  it("endereço que não é perfil não vira @", () => {
    expect(perfilDoX("https://x.com/search?q=meridian")).toBeNull();
    expect(perfilDoX("https://example.com/lighter")).toBeNull();
    expect(perfilDoX(null)).toBeNull();
    expect(perfilDoX("não é url")).toBeNull();
  });
});

describe("descreverPeriodo", () => {
  it("'nesta semana' só quando há uma semana entre as medições", () => {
    expect(descreverPeriodo("2026-10-14", "2026-10-21")).toBe("nesta semana");
    expect(descreverPeriodo("2026-10-09", "2026-10-21")).toBe("nos últimos 12 dias");
    expect(descreverPeriodo("2026-10-20", "2026-10-21")).toBe("desde ontem");
    expect(descreverPeriodo(null, "2026-10-21")).toBeNull();
  });
});

describe("posts", () => {
  it("volume com a evolução da semana, marcando o projeto e a comunidade", () => {
    const texto = postDeVolume({ projeto: polymarket, total: cents(4_230_000), variacao: cents(500_000), periodo: "nesta semana" });
    expect(texto).toContain("📈 +US$ 5.000 de volume em @Polymarket nesta semana.");
    expect(texto).toContain("Total acumulado: US$ 42.300.");
    expect(texto).toContain("@LevelCripto");
    expect(texto).toContain("https://www.levelcripto.com.br/");
    expect(texto.startsWith("@")).toBe(false);
  });

  it("sem medição anterior, mostra só o total", () => {
    const texto = postDeVolume({ projeto: polymarket, total: cents(100_050), variacao: null, periodo: null });
    expect(texto).toContain("Já somo US$ 1.000,50 de volume em @Polymarket.");
  });

  it("projeto sem perfil no X aparece pelo nome", () => {
    const texto = postDePontos({ projeto: { nome: "Lighter", perfil: null }, rotulo: "Pontos", total: points(18_500 * 10_000), variacao: points(3_200 * 10_000), periodo: "nesta semana" });
    expect(texto).toContain("🎯 +3.200 pontos em Lighter nesta semana.");
    expect(texto).toContain("Já somo 18.500 pontos no programa.");
  });

  it("resultado com ROI", () => {
    const texto = postDeResultado({ projeto: polymarket, resultado: cents(125_000), roi: 85.3, airdropRecebido: true });
    expect(texto).toContain("Airdrop de @Polymarket no bolso: resultado de +US$ 1.250.");
    expect(texto).toContain("ROI de 85,3% sobre o capital usado.");
  });

  it("cabe no limite do X mesmo com números e nome grandes", () => {
    const longo = { nome: "Um Nome De Projeto Bem Comprido", perfil: "abcdefghijklmno" };
    for (const texto of [
      postDeVolume({ projeto: longo, total: cents(99_999_999_999), variacao: cents(9_999_999_999), periodo: "nos últimos 365 dias" }),
      postDePontos({ projeto: longo, rotulo: "Experience Points", total: points(99_999_999_999_999), variacao: points(9_999_999_999_999), periodo: "nos últimos 365 dias" }),
      postDeResultado({ projeto: longo, resultado: cents(99_999_999_999), roi: 99999.9, airdropRecebido: true }),
    ]) {
      expect(tamanhoNoX(texto)).toBeLessThanOrEqual(LIMITE_DO_X);
    }
  });
});

describe("linkParaPostar", () => {
  it("abre a tela de publicar com o texto codificado", () => {
    expect(linkParaPostar("+US$ 5 & #1")).toBe("https://x.com/intent/post?text=%2BUS%24%205%20%26%20%231");
  });
  it("dolar arredonda só o que não é redondo", () => {
    expect(dolar(cents(500_000))).toBe("US$ 5.000");
    expect(dolar(cents(1_234_56))).toBe("US$ 1.234,56");
  });
});
