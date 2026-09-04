/**
 * A parte de `restaurar.ts` que não toca no banco, extraída para poder ser
 * testada sem conexão nenhuma.
 *
 * Vive em módulo próprio pelo mesmo motivo de `_tabelas.ts`: importar
 * `restaurar.ts` executaria a restauração, porque ele chama `main()` no nível
 * do módulo (catálogo de erros, item 25). Um módulo que só exporta funções
 * puras não tem como fazer isso.
 */

export type LinhaDoBackup = Record<string, unknown>;

export type Pendencia = {
  tabela: string;
  id: unknown;
  coluna: string;
  valor: unknown;
};

/**
 * Tira, de uma linha, o valor de uma coluna que aponta para uma tabela que só
 * existe depois dela na ordem de inserção.
 *
 * `projects.adopted_from_id` é o caso real: aponta para `catalog_projects`,
 * que só é inserida depois de `projects` (porque a direção mais comum é a
 * inversa, `catalog_projects.source_project_id` -> `projects`). Nenhuma ordem
 * resolve os dois sentidos ao mesmo tempo, então esta coluna entra `null` na
 * inserção e é corrigida numa segunda passada, depois que a tabela que ela
 * referencia já existe.
 *
 * Devolve a linha sem a coluna adiada (pronta para o INSERT) e a pendência a
 * aplicar depois (ou `null`, quando o valor original já era nulo: não há o
 * que corrigir).
 */
export function prepararLinha(
  tabela: string,
  linha: LinhaDoBackup,
  colunaAdiada: string | undefined,
): { linhaPronta: LinhaDoBackup; pendencia: Pendencia | null } {
  if (!colunaAdiada || !(colunaAdiada in linha)) {
    return { linhaPronta: linha, pendencia: null };
  }

  const valorOriginal = linha[colunaAdiada];
  const linhaPronta = { ...linha, [colunaAdiada]: null };

  if (valorOriginal === null || valorOriginal === undefined) {
    return { linhaPronta, pendencia: null };
  }

  return {
    linhaPronta,
    pendencia: { tabela, id: linha.id, coluna: colunaAdiada, valor: valorOriginal },
  };
}
