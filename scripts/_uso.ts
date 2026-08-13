import { neon } from "@neondatabase/serverless";
import { anunciar, resolverAmbiente } from "./_ambiente";
const a = resolverAmbiente(); anunciar(a);
const sql = neon(a.url);
async function main() {
  const t = await sql`
    select relname as tabela,
           to_char(n_live_tup, 'FM999G999') as linhas,
           pg_size_pretty(pg_total_relation_size(relid)) as tamanho,
           pg_total_relation_size(relid) as bytes
    from pg_stat_user_tables
    order by pg_total_relation_size(relid) desc limit 10`;
  console.table(t);
  const [db] = await sql`select pg_size_pretty(pg_database_size(current_database())) as total`;
  console.log("banco inteiro:", db.total);
}
main().then(() => process.exit(0));
