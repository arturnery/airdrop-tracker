/**
 * Carrega os dados de demonstração no banco, para o usuário de SEED_USER_ID.
 *
 * Executar depois de `npm run db:migrate` e `npm run db:seed`:
 *   npm run db:seed-demo
 *
 * Reexecutar é seguro: apaga o que era do usuário antes de inserir. Não toca
 * em dados de outros usuários — todo DELETE filtra por user_id.
 */
import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { eq } from "drizzle-orm";

import * as schema from "../db/schema";
import { datasetInicial } from "../db/queries/fixtures";

config({ path: ".env.local" });

const url = process.env.DATABASE_URL;
const userId = process.env.SEED_USER_ID;

if (!url || !userId) {
  console.error("DATABASE_URL e SEED_USER_ID são obrigatórios em .env.local.");
  process.exit(1);
}

/** Mapeia os ids das fixtures ("prj-vertex") para os uuid do banco. */
const idsProjeto = new Map<string, string>();
const idsConta = new Map<string, string>();
const idsTarefa = new Map<string, string>();
const idsMeta = new Map<string, string>();

async function main() {
  const db = drizzle(neon(url!), { schema });
  const ds = datasetInicial();

  // Limpeza: as FKs em cascata cuidam do resto a partir de projetos e contas.
  console.log("limpando dados anteriores deste usuário…");
  await db.delete(schema.tokenPrices).where(eq(schema.tokenPrices.userId, userId!));
  await db.delete(schema.projects).where(eq(schema.projects.userId, userId!));
  await db.delete(schema.accounts).where(eq(schema.accounts.userId, userId!));

  // ------------------------------------------------------------------ contas
  for (const conta of ds.accounts) {
    const [criada] = await db
      .insert(schema.accounts)
      .values({
        userId: userId!,
        label: conta.label,
        walletAddress: conta.walletAddress,
        email: conta.email,
        isActive: conta.isActive,
      })
      .returning({ id: schema.accounts.id });
    idsConta.set(conta.id, criada!.id);
  }
  console.log(`  ${ds.accounts.length} contas`);

  // ---------------------------------------------------------------- projetos
  for (const projeto of ds.projects) {
    const [criado] = await db
      .insert(schema.projects)
      .values({
        userId: userId!,
        slug: projeto.slug,
        name: projeto.name,
        status: projeto.status,
        category: projeto.category,
        pointsLabel: projeto.pointsLabel,
        chain: projeto.chain,
        priority: projeto.priority,
        websiteUrl: projeto.websiteUrl,
        discordUrl: projeto.discordUrl,
        twitterUrl: projeto.twitterUrl,
        docsUrl: projeto.docsUrl,
        expectedTgeDate: projeto.expectedTgeDate,
        notes: projeto.notes,
      })
      .returning({ id: schema.projects.id });
    idsProjeto.set(projeto.id, criado!.id);
  }
  console.log(`  ${ds.projects.length} projetos`);

  // ------------------------------------------------------------------- pares
  for (const par of ds.projectAccounts) {
    await db.insert(schema.projectAccounts).values({
      projectId: idsProjeto.get(par.projectId)!,
      accountId: idsConta.get(par.accountId)!,
      status: par.status,
      startedAt: par.startedAt,
    });
  }
  console.log(`  ${ds.projectAccounts.length} vínculos projeto×conta`);

  // ------------------------------------------------------------ lançamentos
  for (const t of ds.transactions) {
    await db.insert(schema.transactions).values({
      userId: userId!,
      projectId: idsProjeto.get(t.projectId)!,
      accountId: idsConta.get(t.accountId)!,
      occurredAt: t.occurredAt,
      type: t.type,
      amountUsd: t.amountUsd,
      tokenSymbol: t.tokenSymbol,
      tokenAmount: t.tokenAmount,
      description: t.description,
    });
  }
  console.log(`  ${ds.transactions.length} lançamentos`);

  // --------------------------------------------------------------- cotações
  for (const p of ds.tokenPrices) {
    await db.insert(schema.tokenPrices).values({
      userId: userId!,
      symbol: p.symbol,
      priceUsd: p.priceUsd,
      updatedAt: p.updatedAt,
    });
  }

  // ----------------------------------------------------------------- pontos
  for (const p of ds.pointsSnapshots) {
    await db.insert(schema.pointsSnapshots).values({
      userId: userId!,
      projectId: idsProjeto.get(p.projectId)!,
      accountId: idsConta.get(p.accountId)!,
      takenAt: p.takenAt,
      points: p.points,
      note: p.note,
    });
  }
  console.log(`  ${ds.pointsSnapshots.length} medições de pontos`);

  // ---------------------------------------------------------------- tarefas
  for (const tarefa of ds.tasks) {
    const [criada] = await db
      .insert(schema.tasks)
      .values({
        userId: userId!,
        projectId: idsProjeto.get(tarefa.projectId)!,
        accountId: tarefa.accountId ? idsConta.get(tarefa.accountId)! : null,
        title: tarefa.title,
        description: tarefa.description,
        recurrence: tarefa.recurrence,
        intervalDays: tarefa.intervalDays,
        dueDate: tarefa.dueDate,
        isActive: tarefa.isActive,
      })
      .returning({ id: schema.tasks.id });
    idsTarefa.set(tarefa.id, criada!.id);
  }

  for (const occ of ds.taskOccurrences) {
    await db.insert(schema.taskOccurrences).values({
      taskId: idsTarefa.get(occ.taskId)!,
      accountId: idsConta.get(occ.accountId)!,
      dueDate: occ.dueDate,
      completedAt: occ.completedAt ? new Date(occ.completedAt) : null,
      skipped: occ.skipped,
    });
  }
  console.log(`  ${ds.tasks.length} tarefas, ${ds.taskOccurrences.length} ocorrências`);

  // ------------------------------------------------------------------ metas
  for (const meta of ds.goals) {
    const [criada] = await db
      .insert(schema.goals)
      .values({
        userId: userId!,
        projectId: idsProjeto.get(meta.projectId)!,
        accountId: meta.accountId ? idsConta.get(meta.accountId)! : null,
        title: meta.title,
        metric: meta.metric,
        targetValue: meta.targetValue,
        deadline: meta.deadline,
      })
      .returning({ id: schema.goals.id });
    idsMeta.set(meta.id, criada!.id);
  }

  // ----------------------------------------------------------- recebimentos
  for (const claim of ds.airdropClaims) {
    await db.insert(schema.airdropClaims).values({
      userId: userId!,
      projectId: idsProjeto.get(claim.projectId)!,
      accountId: idsConta.get(claim.accountId)!,
      receivedAt: claim.receivedAt,
      tokenSymbol: claim.tokenSymbol,
      tokenAmount: claim.tokenAmount,
      priceUsd: claim.priceUsd,
      valueUsd: claim.valueUsd,
    });
  }

  console.log("\nPronto. Os dados de demonstração estão no banco.");
}

main().catch((erro) => {
  console.error("Falha ao carregar demonstração:", erro);
  process.exit(1);
});
