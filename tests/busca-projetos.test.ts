import { describe, expect, it } from "vitest";

import { normalizar, slugify } from "@/lib/dataset";

/**
 * A busca compara nomes normalizados: sem acento, sem caixa, sem sobra.
 *
 * Existe separada de `slugify` porque as duas normalizam para fins diferentes,
 * e usar a de URL na busca quebra o caso mais comum: nome com espaço.
 */
describe("normalização para busca", () => {
  it("ignora a caixa", () => {
    expect(normalizar("Vertex Perp")).toBe("vertex perp");
  });

  it("ignora acento, nos dois sentidos", () => {
    expect(normalizar("Solstïce")).toBe("solstice");
    expect(normalizar("solstice").includes(normalizar("SOLSTÏCE"))).toBe(true);
  });

  it("ignora espaço sobrando nas pontas", () => {
    expect(normalizar("  Unit  ")).toBe("unit");
  });

  it("preserva o espaço do meio, ao contrário do slug", () => {
    // O ponto que justifica a função existir: com slugify, procurar
    // "prisma dex" não acharia "Prisma DEX", porque viraria "prisma-dex".
    expect(normalizar("Prisma DEX")).toBe("prisma dex");
    expect(slugify("Prisma DEX")).toBe("prisma-dex");
    expect(normalizar("Prisma DEX").includes("prisma dex")).toBe(true);
  });

  it("acha por pedaço do nome, não só pelo começo", () => {
    expect(normalizar("Vertex Perp").includes(normalizar("perp"))).toBe(true);
  });

  it("termo vazio normaliza para vazio, e a tela usa isso para não filtrar", () => {
    expect(normalizar("   ")).toBe("");
  });
});
