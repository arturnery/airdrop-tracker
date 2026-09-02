import { getTableName, isTable, type Table } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import * as schema from "@/db/schema";
import { FORA_DO_BACKUP, TABELAS } from "@/scripts/_tabelas";

/**
 * O backup precisa alcançar toda tabela do schema.
 *
 * `volume_snapshots` foi criada e não entrou na lista. O backup continuou
 * rodando e relatando quantas linhas salvara, e as medições de volume não
 * estavam em nenhuma delas: **um backup incompleto engana mais do que a falta
 * de um**, porque quem o rodou acha que está protegido.
 *
 * Um comentário no arquivo da lista não teria evitado: quem cria tabela nova
 * mexe em `db/schema.ts`, e não tem motivo para abrir os scripts. Por isso a
 * prevenção é um teste, que roda no CI a cada push e não depende de ninguém
 * lembrar. É a mesma lição do item 1 do catálogo de erros: prevenção que
 * depende de leitura não existe.
 */

/*
 * O módulo exporta tabelas, enums e `relations` juntos, e o tipo da união é
 * específico demais para um predicado genérico atravessar. `unknown[]` deixa
 * `isTable` fazer o estreitamento, que é justamente para o que ele existe.
 */
const exportado: unknown[] = Object.values(schema);

const tabelasDoSchema = exportado
  .filter((valor): valor is Table => isTable(valor))
  .map((tabela) => getTableName(tabela))
  .sort();

describe("cobertura do backup", () => {
  it("salva toda tabela do schema, ou registra por que não salva", () => {
    const cobertas = new Set<string>([...TABELAS, ...Object.keys(FORA_DO_BACKUP)]);
    const esquecidas = tabelasDoSchema.filter((t) => !cobertas.has(t));

    expect(esquecidas, "tabela no schema e fora do backup").toEqual([]);
  });

  it("não lista tabela que não existe mais", () => {
    const existentes = new Set(tabelasDoSchema);
    const fantasmas = [...TABELAS].filter((t) => !existentes.has(t));

    expect(fantasmas, "tabela no backup e fora do schema").toEqual([]);
  });

  /*
   * A ordem é o que faz a restauração passar pelas chaves estrangeiras: ela
   * insere na ordem da lista e apaga na inversa. `users` primeiro não é
   * detalhe, é a condição de qualquer linha com `user_id` entrar.
   */
  it("começa por quem todo mundo referencia", () => {
    expect(TABELAS[0]).toBe("users");
  });

  it("exige um motivo escrito para cada exclusão", () => {
    for (const [tabela, motivo] of Object.entries(FORA_DO_BACKUP)) {
      expect(motivo.length, `motivo de ${tabela}`).toBeGreaterThan(20);
    }
  });
});
