import { describe, expect, it } from "vitest";

import { contarNovidadesNaoVistas, versaoAtual } from "@/lib/changelog";

/**
 * O selo do rodapé mostra quantas mudanças a pessoa ainda não viu. O caso
 * real que motivou isso: um pedido para o sistema "mostrar a evolução
 * constante da ferramenta" com um número visível, não só um ponto.
 */
describe("contarNovidadesNaoVistas", () => {
  it("nunca ter aberto /novidades conta tudo como não visto", () => {
    const total = contarNovidadesNaoVistas(null);
    expect(total).toBeGreaterThan(0);
  });

  it("ter visto a versão mais recente zera a contagem", () => {
    expect(contarNovidadesNaoVistas(versaoAtual)).toBe(0);
  });

  it("versão que não existe mais conta como nada visto, não como zero", () => {
    const total = contarNovidadesNaoVistas("0.1-nunca-existiu");
    expect(total).toBe(contarNovidadesNaoVistas(null));
  });

  it("nunca é negativo", () => {
    expect(contarNovidadesNaoVistas(versaoAtual)).toBeGreaterThanOrEqual(0);
  });
});
