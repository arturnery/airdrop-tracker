/**
 * Torna administrador um membro que já tem conta aprovada.
 *
 *   npx tsx scripts/promover-admin.ts --email pessoa@exemplo.com              → dev, só mostra
 *   npx tsx scripts/promover-admin.ts --email pessoa@exemplo.com --producao --confirmar
 *
 * Existe porque a tela de membros, de propósito, não promove ninguém: um
 * administrador que pudesse criar outros pela interface tornaria uma sessão
 * roubada capaz de se perpetuar. Promover fica no terminal, com acesso ao
 * banco, e deixa rastro no histórico de comandos.
 *
 * Admin pode tudo o que o papel permite: aprovar membros, publicar operações
 * de trade, avisos e destaques. Uma permissão só para operações de trade
 * ("professor") está prevista e, quando existir, é o caminho mais estreito.
 */
import { neon } from "@neondatabase/serverless";

import { anunciar, resolverAmbiente } from "./_ambiente";

const ambiente = resolverAmbiente();
const sql = neon(ambiente.url);
const confirmado = process.argv.includes("--confirmar");
const email = process.argv[process.argv.indexOf("--email") + 1]?.trim().toLowerCase();

async function main() {
  anunciar(ambiente);
  if (!process.argv.includes("--email") || !email || email.startsWith("--")) {
    console.error("Informe o e-mail: --email pessoa@exemplo.com");
    process.exit(1);
  }

  const [conta] = await sql`select id, name, role, status from users where lower(email) = ${email} limit 1`;
  if (!conta) {
    console.error(`Nenhuma conta com ${email}. A pessoa precisa se cadastrar primeiro.`);
    process.exit(1);
  }
  console.log(`conta: ${conta.name} <${email}> (${conta.role}, ${conta.status})`);

  if (conta.role === "admin") {
    console.log("Já é administrador. Nada a fazer.");
    return;
  }
  if (conta.status !== "aprovado") {
    console.error("A conta ainda não foi aprovada. Aprove pela tela de membros antes de promover.");
    process.exit(1);
  }
  if (!confirmado) {
    console.log("\nNada foi alterado. Repita com --confirmar para tornar esta conta administradora.");
    return;
  }

  await sql`update users set role = 'admin' where id = ${conta.id}`;
  const [depois] = await sql`select role from users where id = ${conta.id}`;
  console.log(`\nFeito: ${conta.name} agora é ${depois?.role}. Vale a partir do próximo login dele.`);
}

main().then(() => process.exit(0));
