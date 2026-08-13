/**
 * Devolve o acesso de administrador quando a senha se perde.
 *
 *   npx tsx scripts/liberar-admin.ts
 *   npx tsx scripts/liberar-admin.ts --producao --confirmar
 *
 * Existe porque o administrador é o único sem saída pela interface, e isso é
 * consequência de uma decisão de segurança: `redefinirSenhaDeMembro` recusa
 * gerar senha para contas admin, senão quem administra poderia assumir a conta
 * de outro administrador. O efeito colateral é que ninguém pode gerar a sua.
 *
 * Dois caminhos levam aqui: esquecer a senha, ou restaurar um backup, que não
 * guarda hashes e apaga a senha de todo mundo, inclusive a sua.
 *
 * **O script não define senha nenhuma.** Ele apaga o hash, e uma conta sem hash
 * pode ser reivindicada pela tela de cadastro com o mesmo e-mail: o fluxo já
 * existe, foi por ele que a conta semeada virou conta de verdade. Gerar senha
 * aqui a colocaria no histórico do terminal, que é o lugar errado para ela.
 *
 * Enquanto o hash estiver nulo, ninguém entra nessa conta: a verificação de
 * senha recusa hash ausente. A janela de risco existe, mas exige que alguém
 * saiba o e-mail e chegue à tela de cadastro antes de você.
 */
import { neon } from "@neondatabase/serverless";

import { anunciar, resolverAmbiente } from "./_ambiente";

const ambiente = resolverAmbiente();
const sql = neon(ambiente.url);
const confirmado = process.argv.includes("--confirmar");

async function main() {
  anunciar(ambiente);

  const email = process.env.ADMIN_EMAIL?.toLowerCase();
  if (!email) {
    console.error("ADMIN_EMAIL não está definida neste ambiente.");
    process.exit(1);
  }

  const [conta] = await sql`
    select id, name, role, status, password_hash is null as sem_senha
    from users where email = ${email} limit 1
  `;

  if (!conta) {
    console.error(
      `Nenhuma conta com ${email}.\n` +
        "Cadastre-se pela tela: quem usa o e-mail de ADMIN_EMAIL nasce admin.",
    );
    process.exit(1);
  }

  console.log(`conta:  ${email} (${conta.role}, ${conta.status})`);
  console.log(`senha:  ${conta.sem_senha ? "já está liberada" : "definida"}\n`);

  if (conta.sem_senha) {
    console.log(
      "Nada a fazer. Vá em /criar-conta e cadastre-se com este e-mail para\n" +
        "definir a nova senha.\n",
    );
    return;
  }

  if (!confirmado) {
    console.log(
      "Nada foi alterado. Repita com --confirmar.\n\n" +
        "O que acontece: a senha atual deixa de valer imediatamente e a conta\n" +
        "fica sem senha até você se cadastrar de novo com o mesmo e-mail.\n",
    );
    return;
  }

  await sql`
    update users
    set password_hash = null, must_change_password = false
    where id = ${conta.id}
  `;

  console.log(
    "Senha removida. Agora:\n" +
      "  1. abra /criar-conta\n" +
      `  2. cadastre-se com ${email}\n` +
      "  3. a conta é reconhecida e você define a nova senha\n\n" +
      "Faça isso agora: enquanto o hash estiver nulo, quem souber o e-mail\n" +
      "pode reivindicar a conta pela mesma tela.\n",
  );
}

main().then(() => process.exit(0));
