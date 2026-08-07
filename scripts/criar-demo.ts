/**
 * Cria (ou reconfigura) a conta pública de demonstração.
 *
 * A senha desta conta fica publicada no README, o que muda o que ela pode ser:
 *
 *  - `is_demo` liga o bloqueio de troca de nome e senha. Sem isso, a primeira
 *    pessoa a entrar trancaria as seguintes do lado de fora.
 *  - O papel é sempre `membro`, nunca `admin`. Uma demo administradora
 *    enxergaria a fila de aprovação, com e-mails de terceiros.
 *  - O isolamento por usuário, que já existe, cuida do resto: ela vê apenas os
 *    próprios dados, nunca os de quem mantém o projeto.
 *
 * Rodar de novo restaura a senha e os dados originais, e é assim que se limpa a
 * demonstração depois de alguém bagunçá-la.
 *
 *   npx tsx scripts/criar-demo.ts
 *   npx tsx scripts/criar-demo.ts --producao
 */
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";

import * as schema from "../db/schema";
import { anunciar, resolverAmbiente } from "./_ambiente";

/** Publicadas no README: não são segredo, e é essa a intenção. */
export const DEMO_EMAIL = "demo@airdrop-tracker.app";
export const DEMO_SENHA = "demo1234";
const DEMO_NOME = "Visitante";

const ambiente = resolverAmbiente();

async function main() {
  anunciar(ambiente);

  const db = drizzle(neon(ambiente.url), { schema });
  // Mesmo custo do resto do sistema: não vale abrir exceção para a demo.
  const hash = await bcrypt.hash(DEMO_SENHA, 12);

  const [existente] = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(eq(schema.users.email, DEMO_EMAIL))
    .limit(1);

  if (existente) {
    await db
      .update(schema.users)
      .set({
        name: DEMO_NOME,
        passwordHash: hash,
        isDemo: true,
        role: "membro",
        status: "aprovado",
      })
      .where(eq(schema.users.id, existente.id));
    console.log(`conta atualizada: ${DEMO_EMAIL}`);
  } else {
    await db.insert(schema.users).values({
      name: DEMO_NOME,
      email: DEMO_EMAIL,
      passwordHash: hash,
      isDemo: true,
      role: "membro",
      status: "aprovado",
      reviewedAt: new Date(),
    });
    console.log(`conta criada: ${DEMO_EMAIL}`);
  }

  console.log(`senha: ${DEMO_SENHA}`);
  console.log(
    `\nPara carregar os dados de exemplo nela:\n` +
      `  npx tsx scripts/seed-demo.ts --email ${DEMO_EMAIL}` +
      `${ambiente.nome === "produção" ? " --producao" : ""}\n`,
  );
}

main().then(() => process.exit(0));
