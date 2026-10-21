import "server-only";

import { and, eq, inArray } from "drizzle-orm";

import { db } from "@/db";
import * as schema from "@/db/schema";
import { montarDataset } from "@/db/queries/dataset";
import type { Membro } from "@/lib/ranking";

/**
 * Os membros que entram no ranking, cada um com o próprio Dataset.
 *
 * Quem entra: conta aprovada, com `aparecer_no_ranking` ligado. Conta de
 * demonstração fica de fora em produção, ligada ou não: os números dela são
 * de exemplo, e um ranking real com um "Visitante" no topo seria mentira. Em
 * desenvolvimento ela entra, porque as contas de teste são demonstração e o
 * ranking precisa ter o que mostrar para ser testado.
 *
 * Só as tabelas que o ranking usa são lidas (contas, projetos, pares,
 * lançamentos, pontos, volume, recebimentos), e cada uma numa consulta só para todos
 * os membros, separadas depois por dono. Nenhum dado sai daqui para a tela:
 * quem chama recebe o Dataset para passar aos selectors, e a página entrega
 * ao navegador só as linhas prontas do ranking (`lib/ranking.ts`).
 */
export async function carregarMembrosDoRanking(): Promise<Membro[]> {
  const somenteReais = process.env.NODE_ENV === "production";
  const usuarios = await db
    .select({ id: schema.users.id, nome: schema.users.name, isDemo: schema.users.isDemo })
    .from(schema.users)
    .where(and(eq(schema.users.status, "aprovado"), eq(schema.users.aparecerNoRanking, true)));
  const elegiveis = usuarios.filter((u) => !(somenteReais && u.isDemo));
  if (elegiveis.length === 0) return [];
  const ids = elegiveis.map((u) => u.id);

  const [contas, projetos, lancamentos, pontos, volume, recebimentos] = await Promise.all([
    db.select().from(schema.accounts).where(inArray(schema.accounts.userId, ids)),
    db.select().from(schema.projects).where(inArray(schema.projects.userId, ids)),
    db.select().from(schema.transactions).where(inArray(schema.transactions.userId, ids)),
    db.select().from(schema.pointsSnapshots).where(inArray(schema.pointsSnapshots.userId, ids)),
    db.select().from(schema.volumeSnapshots).where(inArray(schema.volumeSnapshots.userId, ids)),
    db.select().from(schema.airdropClaims).where(inArray(schema.airdropClaims.userId, ids)),
  ]);
  const idsProjeto = projetos.map((p) => p.id);
  const pares =
    idsProjeto.length > 0
      ? await db.select().from(schema.projectAccounts).where(inArray(schema.projectAccounts.projectId, idsProjeto))
      : [];

  const donoDoProjeto = new Map(projetos.map((p) => [p.id, p.userId]));
  const de = <T extends { userId: string }>(linhas: T[], userId: string) =>
    linhas.filter((l) => l.userId === userId);

  return elegiveis.map((u) => ({
    userId: u.id,
    nome: u.nome,
    ds: montarDataset({
      contas: de(contas, u.id),
      projetos: de(projetos, u.id),
      lancamentos: de(lancamentos, u.id),
      pontos: de(pontos, u.id),
      recebimentos: de(recebimentos, u.id),
      pares: pares.filter((p) => donoDoProjeto.get(p.projectId) === u.id),
      volume: de(volume, u.id),
      tarefas: [],
      metas: [],
      catalogo: [],
      ocorrencias: [],
      lancamentosDeMeta: [],
    }),
  }));
}

/** Se a pessoa aparece no ranking: a escolha dela no perfil. */
export async function aparecoNoRanking(userId: string): Promise<boolean> {
  const [linha] = await db
    .select({ aparece: schema.users.aparecerNoRanking })
    .from(schema.users)
    .where(eq(schema.users.id, userId))
    .limit(1);
  return linha?.aparece ?? true;
}
