/**
 * Cria (ou restaura) uma conta de administrador para testar localmente as
 * telas de quem administra: membros, suporte, catálogo e o calendário da
 * comunidade.
 *
 *   npm run admin:teste
 *
 * Depois de criar, carrega nela os mesmos dados de exemplo da conta demo
 * (`seed-demo --email admin@teste.local`): as duas contas de teste têm os
 * mesmos projetos, para que o que se testa numa possa ser comparado na outra.
 *
 * O carregamento é chamado daqui, com argumentos fixos, e não encadeado no
 * `package.json` com `&&`: o npm passa os argumentos extras para o **último**
 * comando da cadeia, e `npm run admin:teste -- --producao` mandaria a criação
 * rodar no desenvolvimento e o carregamento rodar em produção.
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
import { execFileSync } from "node:child_process";

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { and, eq } from "drizzle-orm";
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
  console.log(`senha: ${ADMIN_TESTE_SENHA}\n`);

  // Sem `--producao` na lista, de propósito: o seed resolve o ambiente pelos
  // próprios argumentos, e estes são sempre os de desenvolvimento.
  execFileSync("npx", ["tsx", "scripts/seed-demo.ts", "--email", ADMIN_TESTE_EMAIL], {
    stdio: "inherit",
  });
  await criarDestaqueDeTeste(db, existente?.id ?? (await idDaConta(db)));
}

async function idDaConta(db: ReturnType<typeof drizzle<typeof schema>>) {
  const [conta] = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(eq(schema.users.email, ADMIN_TESTE_EMAIL))
    .limit(1);
  return conta!.id;
}

/**
 * Um destaque que só a conta de admin de teste tem: a conta demo não tem
 * projeto com esse nome, então ele aparece para ela como farm a adicionar, e
 * mudar o status dele aqui exercita o aviso "o admin marcou como…" do lado
 * de lá. Recriado do zero a cada execução, para o teste partir sempre do
 * mesmo ponto.
 */
const DESTAQUE_TESTE = "Astra Points";

async function criarDestaqueDeTeste(db: ReturnType<typeof drizzle<typeof schema>>, userId: string) {
  await db
    .delete(schema.catalogProjects)
    .where(and(eq(schema.catalogProjects.name, DESTAQUE_TESTE), eq(schema.catalogProjects.createdBy, userId)));
  await db
    .delete(schema.projects)
    .where(and(eq(schema.projects.name, DESTAQUE_TESTE), eq(schema.projects.userId, userId)));

  const [projeto] = await db
    .insert(schema.projects)
    .values({
      userId,
      slug: "astra-points",
      name: DESTAQUE_TESTE,
      status: "ativo",
      category: "interacoes",
      pointsLabel: "Pontos",
      priority: 3,
      websiteUrl: "https://example.com/astra",
      farmando: true,
    })
    .returning({ id: schema.projects.id });

  await db.insert(schema.catalogProjects).values({
    slug: `astra-points-teste-${userId.slice(0, 8)}`,
    name: DESTAQUE_TESTE,
    category: "interacoes",
    pointsLabel: "Pontos",
    priority: 3,
    status: "ativo",
    websiteUrl: "https://example.com/astra",
    summary: "Destaque de teste.",
    createdBy: userId,
    sourceProjectId: projeto!.id,
    publishedAt: new Date(),
  });
  console.log(`destaque de teste: ${DESTAQUE_TESTE}`);
}

main().then(() => process.exit(0));
