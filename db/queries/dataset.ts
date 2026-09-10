import "server-only";

import { asc, desc, eq, inArray, isNotNull } from "drizzle-orm";

import { db } from "@/db";
import * as schema from "@/db/schema";
import { materializarOcorrencias } from "@/db/queries/recorrencia";
import type { Dataset } from "@/lib/dataset";

/**
 * Carrega o Dataset completo de um usuário.
 *
 * Devolve exatamente a mesma forma que as fixtures devolviam: por isso
 * `lib/selectors` e `lib/mutations` continuam valendo sem alteração, e as telas
 * não sabem se os dados vieram do Postgres ou do navegador.
 *
 * **Todo SELECT filtra por `userId`.** As tabelas de movimento também têm a
 * coluna, mesmo já pendendo do par projeto×conta: filtrar direto evita
 * depender de join para o isolamento, que é a parte que não pode falhar.
 *
 * Carregar tudo de uma vez é adequado à escala do problema (dezenas de
 * projetos, centenas de lançamentos). Se um dia deixar de ser, o caminho é
 * mover a agregação para SQL: os selectors passam a ser a especificação do
 * que as queries precisam devolver.
 */
export async function carregarDataset(
  userId: string,
  hoje?: string,
): Promise<Dataset> {
  /*
   * Antes de ler, cria as ocorrências recorrentes que faltam. É o motor de
   * recorrência (ARCHITECTURE §6): sem cron, calculado a cada leitura.
   *
   * Uma escrita dentro de uma função de leitura é uma exceção consciente, e o
   * motivo é o modo de falhar: um cron que não roda deixa o dia sem tarefas em
   * silêncio. Aqui não há estado a perder. A função só grava quando falta algo,
   * então a leitura normal não paga nenhuma escrita.
   */
  if (hoje) await materializarOcorrencias(userId, hoje);

  const [
    contas,
    projetos,
    lancamentos,
    pontos,
    volume,
    tarefas,
    metas,
    recebimentos,
    catalogo,
  ] = await Promise.all([
    db
      .select()
      .from(schema.accounts)
      .where(eq(schema.accounts.userId, userId))
      .orderBy(asc(schema.accounts.label)),
    db
      .select()
      .from(schema.projects)
      .where(eq(schema.projects.userId, userId))
      .orderBy(asc(schema.projects.name)),
    db
      .select()
      .from(schema.transactions)
      .where(eq(schema.transactions.userId, userId))
      .orderBy(asc(schema.transactions.occurredAt)),
    db
      .select()
      .from(schema.pointsSnapshots)
      .where(eq(schema.pointsSnapshots.userId, userId))
      .orderBy(asc(schema.pointsSnapshots.takenAt)),
    db
      .select()
      .from(schema.volumeSnapshots)
      .where(eq(schema.volumeSnapshots.userId, userId))
      .orderBy(asc(schema.volumeSnapshots.takenAt)),
    db
      .select()
      .from(schema.tasks)
      .where(eq(schema.tasks.userId, userId)),
    db.select().from(schema.goals).where(eq(schema.goals.userId, userId)),
    db
      .select()
      .from(schema.airdropClaims)
      .where(eq(schema.airdropClaims.userId, userId)),
    /*
     * Sem filtro de usuário: o catálogo é a mesma lista para todo mundo.
     * `isNotNull(publishedAt)` é o único filtro, porque é a única marca de
     * "fora do catálogo" que existe (ver a nota em `db/schema.ts`).
     */
    db
      .select()
      .from(schema.catalogProjects)
      .where(isNotNull(schema.catalogProjects.publishedAt))
      .orderBy(desc(schema.catalogProjects.publishedAt)),
  ]);

  // Pares e ocorrências não têm user_id próprio: pendem de projeto e tarefa,
  // que já foram filtrados acima. Buscar por id evita varrer a tabela inteira.
  const idsProjeto = projetos.map((p) => p.id);
  const idsTarefa = tarefas.map((t) => t.id);

  const idsMeta = metas.map((m) => m.id);

  const [pares, ocorrencias, lancamentosDeMeta] = await Promise.all([
    idsProjeto.length > 0
      ? db
          .select()
          .from(schema.projectAccounts)
          .where(inArray(schema.projectAccounts.projectId, idsProjeto))
      : Promise.resolve([]),
    idsTarefa.length > 0
      ? db
          .select()
          .from(schema.taskOccurrences)
          .where(inArray(schema.taskOccurrences.taskId, idsTarefa))
          .orderBy(asc(schema.taskOccurrences.dueDate))
      : Promise.resolve([]),
    // Progresso das metas: pende de `goals`, já filtrado por usuário acima.
    idsMeta.length > 0
      ? db
          .select()
          .from(schema.goalEntries)
          .where(inArray(schema.goalEntries.goalId, idsMeta))
          .orderBy(asc(schema.goalEntries.occurredAt))
      : Promise.resolve([]),
  ]);

  return {
    accounts: contas.map((c) => ({
      id: c.id,
      label: c.label,
      walletAddress: c.walletAddress,
      email: c.email,
      isActive: c.isActive,
    })),
    projects: projetos.map((p) => ({
      id: p.id,
      slug: p.slug,
      name: p.name,
      status: p.status,
      category: p.category,
      pointsLabel: p.pointsLabel,
      chain: p.chain,
      priority: p.priority,
      websiteUrl: p.websiteUrl,
      discordUrl: p.discordUrl,
      twitterUrl: p.twitterUrl,
      docsUrl: p.docsUrl,
      expectedTgeDate: p.expectedTgeDate,
      notes: p.notes,
      adoptedFromId: p.adoptedFromId,
    })),
    projectAccounts: pares.map((p) => ({
      projectId: p.projectId,
      accountId: p.accountId,
      status: p.status,
      startedAt: p.startedAt,
    })),
    transactions: lancamentos.map((t) => ({
      id: t.id,
      projectId: t.projectId,
      accountId: t.accountId,
      occurredAt: t.occurredAt,
      type: t.type,
      amountUsd: t.amountUsd,
      tokenSymbol: t.tokenSymbol,
      // `numeric` volta como string; o zero à direita não importa para o
      // cálculo, mas incomoda na tela: some aqui, não no componente.
      tokenAmount: t.tokenAmount === null ? null : String(Number(t.tokenAmount)),
      description: t.description,
    })),
    pointsSnapshots: pontos.map((p) => ({
      id: p.id,
      projectId: p.projectId,
      accountId: p.accountId,
      takenAt: p.takenAt,
      points: p.points,
      note: p.note,
    })),
    volumeSnapshots: volume.map((v) => ({
      id: v.id,
      projectId: v.projectId,
      accountId: v.accountId,
      takenAt: v.takenAt,
      volumeUsd: v.volumeUsd,
      note: v.note,
    })),
    tasks: tarefas.map((t) => ({
      id: t.id,
      projectId: t.projectId,
      accountId: t.accountId,
      title: t.title,
      description: t.description,
      recurrence: t.recurrence,
      intervalDays: t.intervalDays,
      dueDate: t.dueDate,
      isActive: t.isActive,
    })),
    taskOccurrences: ocorrencias.map((o) => ({
      id: o.id,
      taskId: o.taskId,
      accountId: o.accountId,
      dueDate: o.dueDate,
      completedAt: o.completedAt ? o.completedAt.toISOString() : null,
      skipped: o.skipped,
    })),
    goals: metas.map((g) => ({
      id: g.id,
      projectId: g.projectId,
      accountId: g.accountId,
      title: g.title,
      metric: g.metric,
      targetValue: g.targetValue,
      deadline: g.deadline,
      achievedAt: g.achievedAt ? g.achievedAt.toISOString().slice(0, 10) : null,
    })),
    goalEntries: lancamentosDeMeta.map((e) => ({
      id: e.id,
      goalId: e.goalId,
      occurredAt: e.occurredAt,
      value: e.value,
      note: e.note,
    })),
    airdropClaims: recebimentos.map((c) => ({
      id: c.id,
      projectId: c.projectId,
      accountId: c.accountId,
      receivedAt: c.receivedAt,
      tokenSymbol: c.tokenSymbol,
      tokenAmount: String(Number(c.tokenAmount)),
      priceUsd: c.priceUsd,
      valueUsd: c.valueUsd,
    })),
    catalogProjects: catalogo.map((c) => ({
      id: c.id,
      slug: c.slug,
      name: c.name,
      category: c.category,
      pointsLabel: c.pointsLabel,
      chain: c.chain,
      priority: c.priority,
      websiteUrl: c.websiteUrl,
      discordUrl: c.discordUrl,
      twitterUrl: c.twitterUrl,
      docsUrl: c.docsUrl,
      expectedTgeDate: c.expectedTgeDate,
      summary: c.summary,
      createdBy: c.createdBy,
      sourceProjectId: c.sourceProjectId,
      publishedAt: c.publishedAt ? c.publishedAt.toISOString() : null,
    })),
  };
}
