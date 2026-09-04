import { describe, expect, it } from "vitest";

import { prepararLinha } from "@/scripts/_restaurar-logica";

/**
 * `projects.adopted_from_id` aponta para `catalog_projects`, que só é inserida
 * depois de `projects` na ordem de restauração (a direção mais comum é a
 * inversa: `catalog_projects.source_project_id` -> `projects`). Um backup com
 * um projeto adotado teria falhado ao restaurar, porque a linha de `projects`
 * chegaria antes da linha de `catalog_projects` que ela referencia.
 *
 * `prepararLinha` é a parte que resolve isso, sem tocar em banco algum.
 */
describe("coluna com referência adiantada", () => {
  it("tira o valor da coluna adiada, e devolve como pendência", () => {
    const linha = { id: "prj-1", name: "Vertex", adopted_from_id: "cat-1" };

    const { linhaPronta, pendencia } = prepararLinha(
      "projects",
      linha,
      "adopted_from_id",
    );

    expect(linhaPronta).toEqual({
      id: "prj-1",
      name: "Vertex",
      adopted_from_id: null,
    });
    expect(pendencia).toEqual({
      tabela: "projects",
      id: "prj-1",
      coluna: "adopted_from_id",
      valor: "cat-1",
    });
  });

  it("não gera pendência quando o valor original já era nulo", () => {
    const linha = { id: "prj-2", name: "Meridian", adopted_from_id: null };

    const { linhaPronta, pendencia } = prepararLinha(
      "projects",
      linha,
      "adopted_from_id",
    );

    expect(linhaPronta.adopted_from_id).toBeNull();
    expect(pendencia, "nada a corrigir na 2ª passada").toBeNull();
  });

  it("não mexe na linha quando a tabela não tem coluna adiada", () => {
    const linha = { id: "acc-1", label: "chrome" };

    const { linhaPronta, pendencia } = prepararLinha("accounts", linha, undefined);

    expect(linhaPronta).toBe(linha);
    expect(pendencia).toBeNull();
  });

  it("não mexe na linha quando a coluna adiada não existe nela", () => {
    // Defensivo: um backup antigo, de antes de a coluna existir, não tem a
    // chave no objeto. `in` evita gravar `undefined` como se fosse um valor.
    const linha = { id: "prj-3", name: "Nebula" };

    const { linhaPronta, pendencia } = prepararLinha(
      "projects",
      linha,
      "adopted_from_id",
    );

    expect(linhaPronta).toBe(linha);
    expect(pendencia).toBeNull();
  });
});
