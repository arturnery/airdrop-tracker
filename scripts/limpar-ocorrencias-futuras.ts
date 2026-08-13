/**
 * Remove ocorrências futuras em excesso, deixando as próximas de cada tarefa.
 *
 * A materialização criava trinta dias à frente, enquanto a tela mostra apenas a
 * próxima ocorrência de cada tarefa. O resultado foram milhares de linhas que
 * ninguém veria. A regra nova cria por contagem, mas as antigas continuam no
 * banco: este script faz a limpeza única.
 *
 * Só apaga o que é **futuro e não concluído**:
 *
 *  - atrasadas ficam, porque são dívida acumulada e some-las esconderia trabalho;
 *  - concluídas ficam, porque são histórico;
 *  - as próximas de cada par tarefa×conta ficam, porque são o que a tela usa.
 *
 *   npx tsx scripts/limpar-ocorrencias-futuras.ts
 *   npx tsx scripts/limpar-ocorrencias-futuras.ts --producao --confirmar
 */
import { neon } from "@neondatabase/serverless";

import { anunciar, resolverAmbiente } from "./_ambiente";

const ambiente = resolverAmbiente();
const sql = neon(ambiente.url);
const confirmado = process.argv.includes("--confirmar");

/** Mesmo número de `datasParaMaterializar`. */
const MANTER = 3;

async function main() {
  anunciar(ambiente);

  const hoje = new Date().toISOString().slice(0, 10);

  /*
   * `row_number()` numera as futuras de cada par tarefa×conta em ordem de data;
   * sobra apagar as que passam do limite. Fazer isso em SQL evita trazer
   * milhares de linhas para o cliente só para decidir quais remover.
   */
  const excedentes = await sql`
    with numeradas as (
      select o.id,
             row_number() over (
               partition by o.task_id, o.account_id order by o.due_date
             ) as posicao
      from task_occurrences o
      where o.completed_at is null and o.due_date >= ${hoje}
    )
    select id from numeradas where posicao > ${MANTER}
  `;

  const [antes] = await sql`select count(*)::int as n from task_occurrences`;
  console.log(`ocorrências hoje: ${antes.n}`);
  console.log(`futuras em excesso: ${excedentes.length}`);

  if (!confirmado) {
    console.log("\nNada foi apagado. Repita com --confirmar.\n");
    return;
  }

  if (excedentes.length > 0) {
    const ids = excedentes.map((e) => e.id as string);
    await sql`delete from task_occurrences where id = any(${ids})`;
  }

  const [depois] = await sql`
    select count(*)::int as total,
           count(*) filter (where completed_at is not null)::int as concluidas,
           count(*) filter (where completed_at is null and due_date < ${hoje})::int as atrasadas
    from task_occurrences`;

  console.log(
    `\nrestaram ${depois.total} (${depois.concluidas} concluídas, ${depois.atrasadas} atrasadas)\n`,
  );
}

main().then(() => process.exit(0));
