import { describe, expect, it } from "vitest";

import { formatUsd, parseUserInput } from "@/lib/money";
import { formatPoints, parsePointsInput } from "@/lib/points";

/**
 * O eco do campo numérico existe para conferir o que foi digitado, então ele
 * precisa mostrar exatamente o que será gravado. Formatador errado exibiria um
 * número plausível e falso, que é pior que não mostrar nada.
 */
describe("eco dos campos numéricos", () => {
  it("dinheiro: mostra o mesmo valor que vai ao banco", () => {
    const p = parseUserInput("10000");
    expect(p.ok).toBe(true);
    if (p.ok) expect(formatUsd(p.value)).toBe("$10,000.00");
  });

  it("dinheiro: separador de milhar resolve a ambiguidade de 10.005", () => {
    const p = parseUserInput("10.005");
    expect(p.ok).toBe(true);
    // Decisão registrada: ponto como milhar, teclado brasileiro.
    if (p.ok) expect(formatUsd(p.value)).toBe("$10,005.00");
  });

  it("pontos: usa a escala de pontos, não a de dinheiro", () => {
    const p = parsePointsInput("12.450");
    expect(p.ok).toBe(true);
    if (p.ok) {
      const comoPontos = formatPoints(p.value);
      expect(comoPontos).toContain("12");
      // Pontos e dinheiro são grandezas distintas: o mesmo texto não pode
      // produzir a mesma saída formatada por acaso.
      expect(comoPontos).not.toContain("$");
    }
  });

  it("entrada inválida não vira eco: nada é mostrado", () => {
    expect(parseUserInput("abc").ok).toBe(false);
    expect(parsePointsInput("1.5,5").ok).toBe(false);
  });
});
