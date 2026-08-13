import { neon } from "@neondatabase/serverless";
import { resolverAmbiente } from "./_ambiente";
const a = resolverAmbiente();
const sql = neon(a.url);
async function main() {
  const r = await sql`
    select count(*)::int as ocorrencias,
           pg_size_pretty(pg_total_relation_size('task_occurrences')) as tamanho
    from task_occurrences`;
  const [u] = await sql`
    select count(*) filter (where ocorrencias_em is not null)::int as com_marca
    from users`;
  console.log("ocorrências:", r[0].ocorrencias, "| tabela:", r[0].tamanho, "| usuários com marca:", u.com_marca);
}
main().then(() => process.exit(0));
