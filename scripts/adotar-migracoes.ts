/**
 * Registra migrações já refletidas no banco, sem reaplicá-las.
 *
 * O banco nasceu de `drizzle-kit push`, que sincroniza o schema direto e não
 * escreve nada na tabela de controle. O resultado é um banco com as 14 tabelas
 * certas e um histórico de migrações vazio: na primeira vez que se roda
 * `db:migrate`, o Drizzle conclui que nada foi aplicado e tenta criar tudo de
 * novo, esbarrando em "already exists".
 *
 * Este script fecha essa lacuna marcando como aplicadas as migrações que o
 * banco já reflete. É o passo único de adoção; daí em diante `db:migrate`
 * funciona normalmente.
 *
 *   npx tsx scripts/adotar-migracoes.ts 0000_inicial
 *   npx tsx scripts/adotar-migracoes.ts 0000_inicial --producao
 *
 * O hash é o SHA-256 do conteúdo do arquivo, e `created_at` é o carimbo do
 * journal: é assim que o Drizzle identifica cada migração, então gravar
 * qualquer outra coisa faria a próxima execução tentar aplicá-la de novo.
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

import { neon } from "@neondatabase/serverless";

import { anunciar, resolverAmbiente } from "./_ambiente";

type Entrada = { idx: number; when: number; tag: string };

const ambiente = resolverAmbiente();
const sql = neon(ambiente.url);

const alvos = process.argv.slice(2).filter((a) => !a.startsWith("--"));
if (alvos.length === 0) {
  console.error("Informe a tag da migração. Ex: 0000_inicial");
  process.exit(1);
}

async function main() {
  anunciar(ambiente);

  const journal = JSON.parse(
    readFileSync("drizzle/meta/_journal.json", "utf8"),
  ) as { entries: Entrada[] };

  await sql`create schema if not exists drizzle`;
  await sql`
    create table if not exists drizzle.__drizzle_migrations (
      id serial primary key,
      hash text not null,
      created_at bigint
    )
  `;

  for (const tag of alvos) {
    const entrada = journal.entries.find((e) => e.tag === tag);
    if (!entrada) {
      console.error(`  ${tag}: não existe no journal`);
      process.exit(1);
    }

    const conteudo = readFileSync(`drizzle/${tag}.sql`, "utf8");
    const hash = createHash("sha256").update(conteudo).digest("hex");

    const [existe] = await sql`
      select id from drizzle.__drizzle_migrations where hash = ${hash} limit 1
    `;
    if (existe) {
      console.log(`  ${tag}: já registrada`);
      continue;
    }

    await sql`
      insert into drizzle.__drizzle_migrations (hash, created_at)
      values (${hash}, ${entrada.when})
    `;
    console.log(`  ${tag}: registrada como aplicada`);
  }

  console.log("\nPronto. `npm run db:migrate` agora aplica só o que falta.\n");
}

main().then(() => process.exit(0));
