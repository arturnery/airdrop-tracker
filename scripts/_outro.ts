import { neon } from "@neondatabase/serverless";
import { resolverAmbiente } from "./_ambiente";
const a = resolverAmbiente();
const sql = neon(a.url);
async function main() {
  const [par] = await sql`
    select pa.project_id, pa.account_id, p.slug, u.id as user_id
    from project_accounts pa
    join projects p on p.id = pa.project_id
    join users u on u.id = p.user_id
    where u.email='demo@airdrop-tracker.app' limit 1`;
  await sql`
    insert into transactions (user_id, project_id, account_id, occurred_at, type, amount_usd, description)
    values (${par.user_id}, ${par.project_id}, ${par.account_id}, current_date, 'other', '3.50', 'teste tipo outro')`;
  console.log("inserido em:", par.slug);
  const r = await sql`select type, amount_usd, description from transactions where description='teste tipo outro'`;
  console.log("no banco:", r);
}
main().then(() => process.exit(0));
