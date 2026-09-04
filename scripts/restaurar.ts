/**
 * Restaura um arquivo de backup num banco.
 *
 *   npx tsx scripts/restaurar.ts backups/producao-2026-08-13.json
 *   npx tsx scripts/restaurar.ts backups/producao-2026-08-13.json --confirmar
 *
 * **Teste a restauração antes de precisar dela.** Backup que ninguém tentou
 * restaurar é só um arquivo: restaure em desenvolvimento de vez em quando,
 * abra o sistema e confira. Descobrir que o backup não presta no dia calmo é
 * muito melhor que no dia do desastre.
 *
 * Exige um banco com a estrutura já criada (`npm run db:migrate`), porque o
 * arquivo guarda dados e não estrutura.
 *
 * Apaga o que existe antes de inserir. Mesclar seria pior: registros editados
 * depois do backup ficariam misturados com os antigos, e ninguém saberia qual é
 * qual. Restaurar é voltar a um instante, não somar dois.
 */
import { readFileSync } from "node:fs";

import { neon } from "@neondatabase/serverless";

import { anunciar, resolverAmbiente } from "./_ambiente";
import { prepararLinha, type Pendencia } from "./_restaurar-logica";
import { TABELAS } from "./_tabelas";

const ambiente = resolverAmbiente();
const sql = neon(ambiente.url);
const confirmado = process.argv.includes("--confirmar");
const caminho = process.argv.slice(2).find((a) => !a.startsWith("--"));

type Arquivo = {
  versao: number;
  geradoEm: string;
  ambiente: string;
  contemSenhas: boolean;
  tabelas: Record<string, Record<string, unknown>[]>;
};

/**
 * Colunas que apontam para uma tabela que só existe **depois**, na ordem de
 * `TABELAS`, do que a própria.
 *
 * `projects` vem antes de `catalog_projects` porque uma entrada do catálogo
 * pende de um projeto de origem (`catalog_projects.source_project_id`), e
 * essa é a direção comum. Mas um projeto **adotado** aponta de volta para o
 * catálogo (`projects.adopted_from_id`), e nenhuma ordem resolve os dois
 * sentidos ao mesmo tempo: inserir `projects` primeiro deixa essa coluna sem
 * a linha que ela referencia.
 *
 * A coluna listada aqui entra `null` na inserção normal e é corrigida numa
 * segunda passada, depois que toda tabela já foi carregada. Sem isso, o
 * primeiro backup com um projeto adotado teria falhado ao restaurar, e é
 * exatamente o tipo de defeito que só aparece no dia em que já se precisa
 * dele: por isso o teste `tests/restaurar-referencia-adiantada.test.ts`.
 */
const ADIAR: Record<string, string> = {
  projects: "adopted_from_id",
};

async function main() {
  if (!caminho) {
    console.error("Informe o arquivo. Ex: backups/producao-2026-08-13.json");
    process.exit(1);
  }

  anunciar(ambiente);

  const arquivo = JSON.parse(readFileSync(caminho, "utf8")) as Arquivo;
  const linhas = Object.values(arquivo.tabelas).reduce(
    (acc, t) => acc + t.length,
    0,
  );

  console.log(`arquivo:  ${caminho}`);
  console.log(`gerado:   ${arquivo.geradoEm} (${arquivo.ambiente})`);
  console.log(`conteúdo: ${linhas} linhas, ${arquivo.contemSenhas ? "com" : "sem"} senhas\n`);

  if (!confirmado) {
    console.log(
      "Nada foi alterado. Repita com --confirmar.\n" +
        "APAGA todos os dados atuais deste banco antes de inserir.\n",
    );
    return;
  }

  /*
   * Apaga na ordem inversa da inserção: quem referencia sai antes de quem é
   * referenciado, senão a chave estrangeira recusa a remoção.
   */
  for (const tabela of [...TABELAS].reverse()) {
    await sql.query(`delete from ${tabela}`);
  }

  let inseridas = 0;
  const pendentes: Pendencia[] = [];

  for (const tabela of TABELAS) {
    const dados = arquivo.tabelas[tabela] ?? [];
    if (dados.length === 0) continue;

    for (const linha of dados) {
      const { linhaPronta, pendencia } = prepararLinha(tabela, linha, ADIAR[tabela]);
      if (pendencia) pendentes.push(pendencia);

      const colunas = Object.keys(linhaPronta);
      const valores = colunas.map((c) => linhaPronta[c]);
      const marcadores = colunas.map((_, i) => `$${i + 1}`).join(", ");

      await sql.query(
        `insert into ${tabela} (${colunas.map((c) => `"${c}"`).join(", ")}) values (${marcadores})`,
        valores,
      );
    }

    inseridas += dados.length;
    console.log(`  ${tabela}: ${dados.length}`);
  }

  // Segunda passada: agora toda tabela existe, então a referência adiantada
  // já tem o que apontar.
  for (const p of pendentes) {
    await sql.query(`update ${p.tabela} set "${p.coluna}" = $1 where id = $2`, [
      p.valor,
      p.id,
    ]);
  }
  if (pendentes.length > 0) {
    console.log(`  (${pendentes.length} referência(s) adiantada(s) corrigida(s) na 2ª passada)`);
  }

  console.log(`\n${inseridas} linhas restauradas.`);
  if (!arquivo.contemSenhas) {
    console.log(
      "Sem senhas no arquivo: gere temporárias na tela de membros para liberar o acesso.\n",
    );
  }
}

main().then(() => process.exit(0));
