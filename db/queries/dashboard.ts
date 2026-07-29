import "server-only";

import { summarizeFinancials } from "@/lib/finance";
import { fromDbNumeric } from "@/lib/money";
import type { CapitalPorProjeto, DashboardSummary } from "@/lib/types";
import { urgencyOf } from "@/lib/dates";

import {
  HOJE,
  rawAirdropClaims,
  rawBalanceSnapshots,
  rawProjectAccounts,
  rawProjects,
  rawTaskOccurrences,
  rawTransactions,
} from "./fixtures";
import { exposicaoPorProjeto } from "./shared";

/**
 * Leitura do dashboard geral.
 *
 * Hoje agrega fixtures em memória; na fase de backend o corpo vira SQL e a
 * assinatura permanece. As telas dependem só do tipo de retorno.
 */

export async function getDashboardSummary(): Promise<DashboardSummary> {
  const financeiro = summarizeFinancials({
    movements: rawTransactions,
    snapshots: rawBalanceSnapshots,
    pairs: rawProjectAccounts,
    airdropsUsd: rawAirdropClaims.map((c) => c.valueUsd),
  });

  const pendentes = rawTaskOccurrences.filter((o) => !o.completedAt && !o.skipped);
  const tarefasHoje = pendentes.filter(
    (o) => urgencyOf(o.dueDate, HOJE) === "hoje",
  ).length;
  const tarefasAtrasadas = pendentes.filter(
    (o) => urgencyOf(o.dueDate, HOJE) === "atrasada",
  ).length;

  const contasAtivas = new Set(
    rawProjectAccounts.filter((p) => p.status === "ativa").map((p) => p.accountId),
  ).size;

  return {
    ...financeiro,
    projetosAtivos: rawProjects.filter((p) => p.status === "ativo").length,
    projetosTotal: rawProjects.length,
    contasAtivas,
    tarefasHoje,
    tarefasAtrasadas,
  };
}

/** Capital por projeto, para o gráfico de distribuição. */
export async function getCapitalPorProjeto(): Promise<CapitalPorProjeto[]> {
  const exposicoes = exposicaoPorProjeto();

  return rawProjects
    .map((projeto) => {
      const aportado = rawTransactions
        .filter((t) => t.projectId === projeto.id && t.type === "deposit")
        .reduce((acc, t) => acc + fromDbNumeric(t.amountUsd), 0);

      return {
        slug: projeto.slug,
        nome: projeto.name,
        aportado: aportado as CapitalPorProjeto["aportado"],
        exposicao: (exposicoes.get(projeto.id) ?? 0) as CapitalPorProjeto["exposicao"],
      };
    })
    .filter((p) => p.aportado > 0 || p.exposicao > 0)
    .sort((a, b) => b.aportado - a.aportado);
}
