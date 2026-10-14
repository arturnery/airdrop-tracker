/**
 * Cria (ou restaura) uma conta de administrador para testar localmente as
 * telas de quem administra: membros, suporte, catálogo e o calendário da
 * comunidade.
 *
 *   npm run admin:teste
 *
 * **Só no banco de desenvolvimento, e isso não é configurável.** A senha é
 * conhecida e fácil de adivinhar, o que é o ponto num banco descartável e um
 * desastre em produção: quem administra vê o e-mail de todos os membros e
 * decide quem entra. Por isso o script recusa `--producao` em vez de aceitar
 * com confirmação.
 *
 * `is_demo` trava a troca de nome e senha pela tela, como na conta de
 * demonstração, para a conta continuar com a senha que todo mundo que testa
 * conhece. Rodar de novo restaura senha, papel e aprovação.
 */
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";

import * as schema from "../db/schema";
import { anunciar, resolverAmbiente } from "./_ambiente";

export const ADMIN_TESTE_EMAIL = "admin@teste.local";
export const ADMIN_TESTE_SENHA = "teste@1234";

const ambiente = resolverAmbiente();

async function main() {
  anunciar(ambiente);
  if (ambiente.nome !== "desenvolvimento") {
    console.error("Recusado: a conta de administrador de teste só existe no banco de desenvolvimento.");
    process.exit(1);
  }

  const db = drizzle(neon(ambiente.url), { schema });
  const hash = await bcrypt.hash(ADMIN_TESTE_SENHA, 12);
  const campos = {
    name: "Admin de teste",
    passwordHash: hash,
    role: "admin" as const,
    status: "aprovado" as const,
    isDemo: true,
    mustChangePassword: false,
  };

  const [existente] = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(eq(schema.users.email, ADMIN_TESTE_EMAIL))
    .limit(1);

  if (existente) {
    await db.update(schema.users).set(campos).where(eq(schema.users.id, existente.id));
    console.log(`conta restaurada: ${ADMIN_TESTE_EMAIL}`);
  } else {
    await db
      .insert(schema.users)
      .values({ ...campos, email: ADMIN_TESTE_EMAIL, reviewedAt: new Date() });
    console.log(`conta criada: ${ADMIN_TESTE_EMAIL}`);
  }
  console.log(`senha: ${ADMIN_TESTE_SENHA}`);
}

main().then(() => process.exit(0));
