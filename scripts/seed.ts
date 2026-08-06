/**
 * Cria a conta de administrador e imprime o UUID para colar em SEED_USER_ID.
 *
 * Executar depois de `npm run db:push`:
 *   npm run db:seed
 *
 * A conta nasce sem senha (`password_hash` nulo). A senha é definida por você
 * no primeiro cadastro pela tela: este script não pede nem guarda senha, e
 * senha em variável de ambiente ou em argumento de linha de comando acabaria
 * no histórico do shell.
 */
import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { eq } from "drizzle-orm";

import { users } from "../db/schema";

config({ path: ".env.local" });

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL ausente. Preencha .env.local antes de semear.");
  process.exit(1);
}

const EMAIL = process.env.ADMIN_EMAIL?.trim().toLowerCase();
if (!EMAIL) {
  console.error(
    "ADMIN_EMAIL ausente. Defina em .env.local o e-mail que vai administrar.",
  );
  process.exit(1);
}

const NOME = process.env.ADMIN_NAME ?? "Administrador";

async function main() {
  const db = drizzle(neon(url!));

  const existente = await db
    .select()
    .from(users)
    .where(eq(users.email, EMAIL!))
    .limit(1);

  if (existente.length > 0) {
    const usuario = existente[0]!;

    // Já existe: garante o papel em vez de recriar. Cobre o caso de a conta ter
    // sido criada pela tela antes de ADMIN_EMAIL ser configurado.
    if (usuario.role !== "admin" || usuario.status !== "aprovado") {
      await db
        .update(users)
        .set({ role: "admin", status: "aprovado", reviewedAt: new Date() })
        .where(eq(users.id, usuario.id));
      console.log(`Conta existente promovida a administrador: ${usuario.email}`);
    } else {
      console.log(`Administrador já configurado: ${usuario.email}`);
    }

    console.log(`\nSEED_USER_ID="${usuario.id}"`);
    return;
  }

  const [criado] = await db
    .insert(users)
    .values({
      email: EMAIL!,
      name: NOME,
      role: "admin",
      status: "aprovado",
      reviewedAt: new Date(),
    })
    .returning();

  console.log(`Administrador criado: ${criado!.email}`);
  console.log("Defina a senha no primeiro acesso, pela tela de cadastro.");
  console.log(`\nCole em .env.local:\nSEED_USER_ID="${criado!.id}"`);
}

main().catch((erro) => {
  console.error("Falha ao semear:", erro);
  process.exit(1);
});
