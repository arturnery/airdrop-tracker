/**
 * Apaga os dados de um banco, preservando as contas de acesso.
 *
 * Serve para zerar um ambiente sem obrigar ninguém a recadastrar login: saem
 * projetos, contas de carteira, lançamentos, tarefas, metas, pontos, cotações e
 * lotes de importação. Ficam `users` e `profile_settings`, que são a identidade
 * e as preferências de quem entra.
 *
 * Quase tudo cai por cascata a partir de `projects` e `accounts`. As duas
 * exceções penduram direto em `users` e por isso são apagadas à mão.
 *
 * É destrutivo e não tem volta, então exige confirmação explícita e imprime o
 * host alvo antes de agir: rodar isso no banco errado é o tipo de engano que
 * um script assim precisa dificultar.
 *
 *   npx tsx scripts/limpar-dados.ts              # só mostra o que faria
 *   npx tsx scripts/limpar-dados.ts --confirmar  # apaga
 */
import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";

config({ path: ".env.local" });

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL não definida.");
  process.exit(1);
}

const sql = neon(url);
const confirmado = process.argv.includes("--confirmar");

async function main() {
  const host = url!.match(/@([^/]+)/)?.[1] ?? "desconhecido";
  console.log(`\nBanco: ${host}\n`);

  const antes = await sql`
    select
      (select count(*) from users) as usuarios,
      (select count(*) from projects) as projetos,
      (select count(*) from accounts) as contas,
      (select count(*) from transactions) as lancamentos,
      (select count(*) from tasks) as tarefas,
      (select count(*) from token_prices) as cotacoes
  `;
  console.log("Antes:", antes[0]);

  if (!confirmado) {
    console.log(
      "\nNada foi apagado. Para apagar de verdade:\n" +
        "  npx tsx scripts/limpar-dados.ts --confirmar\n",
    );
    return;
  }

  // A ordem importa menos por causa das cascatas, mas manter explícito ajuda a
  // ler o que sai.
  await sql`delete from projects`;
  await sql`delete from accounts`;
  await sql`delete from token_prices`;
  await sql`delete from import_batches`;

  const depois = await sql`
    select
      (select count(*) from users) as usuarios,
      (select count(*) from projects) as projetos,
      (select count(*) from accounts) as contas,
      (select count(*) from transactions) as lancamentos,
      (select count(*) from tasks) as tarefas,
      (select count(*) from task_occurrences) as ocorrencias,
      (select count(*) from token_prices) as cotacoes
  `;
  console.log("Depois:", depois[0]);

  const quem = await sql`select email, role, status from users order by email`;
  console.log("\nContas de acesso preservadas:");
  for (const u of quem) console.log(`  ${u.email} (${u.role}, ${u.status})`);
  console.log();
}

main().then(() => process.exit(0));
