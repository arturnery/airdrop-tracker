/**
 * Reparo pontual: cria ocorrências para tarefas que nasceram sem nenhuma.
 *
 * Antes da correção, uma tarefa criada com o campo "Conta" em branco num
 * projeto sem vínculo gerava zero ocorrências. A tarefa ficava no banco mas não
 * aparecia em tela nenhuma, e nem dava para apagar pela interface.
 *
 * O script não apaga nada: torna visível o que já tinha sido criado, e daí a
 * pessoa decide o que fazer pela tela.
 *
 *   npx tsx scripts/reparar-tarefas-sem-ocorrencia.ts
 */
import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";

config({ path: ".env.local" });
const sql = neon(process.env.DATABASE_URL!);

async function main() {
  const orfas = await sql`
    select t.id, t.title, t.user_id, t.project_id, t.due_date
    from tasks t
    where not exists (select 1 from task_occurrences o where o.task_id = t.id)
  `;

  if (orfas.length === 0) {
    console.log("Nada a reparar.");
    return;
  }

  let criadas = 0;
  for (const tarefa of orfas) {
    // Mesma regra de contasAlvoDaTarefa: vínculos do projeto ou, na falta
    // deles, todas as contas da pessoa.
    const vinculadas = await sql`
      select account_id from project_accounts where project_id = ${tarefa.project_id}
    `;
    const alvo =
      vinculadas.length > 0
        ? vinculadas.map((v) => v.account_id)
        : (await sql`select id from accounts where user_id = ${tarefa.user_id}`).map(
            (c) => c.id,
          );

    if (alvo.length === 0) {
      console.log(`  sem conta para "${tarefa.title}": pulando`);
      continue;
    }

    const vencimento = tarefa.due_date ?? new Date().toISOString().slice(0, 10);
    for (const accountId of alvo) {
      await sql`
        insert into task_occurrences (task_id, account_id, due_date)
        values (${tarefa.id}, ${accountId}, ${vencimento})
        on conflict do nothing
      `;
      criadas += 1;
    }
    console.log(`  "${tarefa.title}": ${alvo.length} ocorrência(s)`);
  }

  console.log(`\n${orfas.length} tarefa(s) reparada(s), ${criadas} ocorrência(s).`);
}

main().then(() => process.exit(0));
