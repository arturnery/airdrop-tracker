/**
 * Cria o usuário local e imprime o UUID para colar em SEED_USER_ID.
 *
 * Executar depois de `npm run db:push`:
 *   npm run db:seed
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

const EMAIL = process.env.SEED_USER_EMAIL ?? "arturnery97@gmail.com";
const NAME = process.env.SEED_USER_NAME ?? "Artur";

async function main() {
  const db = drizzle(neon(url!));

  const existing = await db
    .select()
    .from(users)
    .where(eq(users.email, EMAIL))
    .limit(1);

  if (existing.length > 0) {
    const user = existing[0]!;
    console.log(`Usuário já existia: ${user.email}`);
    console.log(`\nSEED_USER_ID="${user.id}"`);
    return;
  }

  const [created] = await db
    .insert(users)
    .values({ email: EMAIL, name: NAME })
    .returning();

  console.log(`Usuário criado: ${created!.email}`);
  console.log(`\nCole em .env.local:\nSEED_USER_ID="${created!.id}"`);
}

main().catch((error) => {
  console.error("Falha ao semear:", error);
  process.exit(1);
});
