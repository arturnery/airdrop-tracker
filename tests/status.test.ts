import { describe, expect, it } from "vitest";

import { nomeRiscado } from "@/components/status-badge";
import type { ProjectStatus } from "@/lib/types";

const todos: ProjectStatus[] = [
  "pesquisando",
  "ativo",
  "pausado",
  "tge_anunciado",
  "distribuido",
  "descartado",
];

describe("nomeRiscado", () => {
  it("risca o nome de projeto descartado", () => {
    expect(nomeRiscado("descartado")).toContain("line-through");
  });

  it("não risca nenhum outro status", () => {
    for (const status of todos.filter((s) => s !== "descartado")) {
      expect(nomeRiscado(status)).toBe("");
    }
  });

  /**
   * O risco pertence ao nome do projeto. Já esteve no estilo do badge, o que
   * riscava a palavra "Descartado" e deixava o próprio rótulo ilegível.
   */
  it("projeto distribuído continua legível", () => {
    expect(nomeRiscado("distribuido")).toBe("");
  });
});
