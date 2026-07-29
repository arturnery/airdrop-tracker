import "server-only";

import { relativeLabel } from "@/lib/dates";
import { sumOfType, summarizeFinancials } from "@/lib/finance";
import { cents, fromDbNumeric, percentOf, subtractCents, ZERO } from "@/lib/money";
import type {
  AirdropClaimRow,
  GoalRow,
  ProjectAccountRow,
  ProjectDetail,
  ProjectSummary,
  TransactionRow,
} from "@/lib/types";

import {
  rawAccounts,
  rawAirdropClaims,
  rawBalanceSnapshots,
  rawGoals,
  rawProjectAccounts,
  rawProjects,
  rawTaskOccurrences,
  rawTasks,
  rawTransactions,
} from "./fixtures";
import { exposicaoDoPar, exposicaoPorProjeto, ultimaAtividade } from "./shared";

const labelDaConta = (accountId: string) =>
  rawAccounts.find((a) => a.id === accountId)?.label ?? "conta removida";

function tarefasPendentesDoProjeto(projectId: string) {
  const idsDasTarefas = rawTasks
    .filter((t) => t.projectId === projectId && t.isActive)
    .map((t) => t.id);
  return rawTaskOccurrences.filter(
    (o) => idsDasTarefas.includes(o.taskId) && !o.completedAt && !o.skipped,
  );
}

export async function listProjects(): Promise<ProjectSummary[]> {
  const exposicoes = exposicaoPorProjeto();

  return rawProjects
    .map((projeto) => {
      const movimentos = rawTransactions.filter((t) => t.projectId === projeto.id);
      const aportado = sumOfType(movimentos, "deposit");
      const exposicao = exposicoes.get(projeto.id) ?? ZERO;
      const resultado = subtractCents(exposicao, aportado);
      const pendentes = tarefasPendentesDoProjeto(projeto.id);

      return {
        id: projeto.id,
        slug: projeto.slug,
        nome: projeto.name,
        status: projeto.status,
        chain: projeto.chain,
        prioridade: projeto.priority,
        aportado,
        exposicao,
        resultado,
        roi: percentOf(resultado, aportado),
        contas: rawProjectAccounts.filter((p) => p.projectId === projeto.id).length,
        tarefasPendentes: pendentes.length,
        tarefasAtrasadas: pendentes.filter((o) => o.dueDate < "2026-07-28").length,
        ultimaAtividade: ultimaAtividade((t) => t.projectId === projeto.id),
        tgePrevisto: projeto.expectedTgeDate,
      } satisfies ProjectSummary;
    })
    .sort((a, b) => b.prioridade - a.prioridade || b.aportado - a.aportado);
}

export async function getProjectBySlug(slug: string): Promise<ProjectDetail | null> {
  const projeto = rawProjects.find((p) => p.slug === slug);
  if (!projeto) return null;

  const pares = rawProjectAccounts.filter((p) => p.projectId === projeto.id);
  const movimentos = rawTransactions.filter((t) => t.projectId === projeto.id);
  const snaps = rawBalanceSnapshots.filter((s) => s.projectId === projeto.id);
  const claims = rawAirdropClaims.filter((c) => c.projectId === projeto.id);

  const financeiro = summarizeFinancials({
    movements: movimentos,
    snapshots: snaps,
    pairs: pares,
    airdropsUsd: claims.map((c) => c.valueUsd),
  });

  const pendentes = tarefasPendentesDoProjeto(projeto.id);

  // --------------------------------------------------------- conta por conta
  const contasDetalhe: ProjectAccountRow[] = pares
    .map((par) => {
      const doPar = movimentos.filter((t) => t.accountId === par.accountId);
      const aportado = sumOfType(doPar, "deposit");
      const exposure = exposicaoDoPar(projeto.id, par.accountId);
      const idsTarefas = rawTasks
        .filter(
          (t) =>
            t.projectId === projeto.id &&
            t.isActive &&
            (t.accountId === null || t.accountId === par.accountId),
        )
        .map((t) => t.id);

      return {
        contaId: par.accountId,
        label: labelDaConta(par.accountId),
        status: par.status,
        aportado,
        saldo: exposure.confirmed ? exposure.value : null,
        saldoEm: exposure.takenAt,
        resultado: exposure.confirmed
          ? subtractCents(exposure.value, aportado)
          : null,
        tarefasPendentes: rawTaskOccurrences.filter(
          (o) =>
            idsTarefas.includes(o.taskId) &&
            o.accountId === par.accountId &&
            !o.completedAt &&
            !o.skipped,
        ).length,
        ultimaAtividade: ultimaAtividade(
          (t) => t.projectId === projeto.id && t.accountId === par.accountId,
        ),
      } satisfies ProjectAccountRow;
    })
    .sort((a, b) => b.aportado - a.aportado);

  // ---------------------------------------------------------------- histórico
  const historicoTx: TransactionRow[] = movimentos.map((t) => ({
    id: t.id,
    data: t.occurredAt,
    projetoSlug: projeto.slug,
    projetoNome: projeto.name,
    contaLabel: labelDaConta(t.accountId),
    tipo: t.type,
    valor: fromDbNumeric(t.amountUsd),
    descricao: t.description,
  }));

  const historicoSnap: TransactionRow[] = snaps.map((s) => ({
    id: s.id,
    data: s.takenAt,
    projetoSlug: projeto.slug,
    projetoNome: projeto.name,
    contaLabel: labelDaConta(s.accountId),
    tipo: "other",
    valor: fromDbNumeric(s.balanceUsd),
    descricao: "Saldo atualizado",
    isSnapshot: true,
  }));

  const historico = [...historicoTx, ...historicoSnap].sort((a, b) =>
    b.data.localeCompare(a.data),
  );

  // -------------------------------------------------------------------- metas
  const metas: GoalRow[] = rawGoals
    .filter((g) => g.projectId === projeto.id)
    .map((g) => {
      // Fonte de cada métrica conforme ARCHITECTURE.md §4.3-C.
      const relevantes = movimentos.filter(
        (t) => g.accountId === null || t.accountId === g.accountId,
      );
      let atual = ZERO;
      if (g.metric === "volume_usd") {
        atual = sumOfType(relevantes, "volume_traded");
      } else if (g.metric === "balance_usd") {
        atual = exposicaoDoPar(projeto.id, g.accountId ?? "").value;
      } else if (g.metric === "tx_count") {
        atual = cents(relevantes.length);
      } else {
        atual = cents(new Set(relevantes.map((t) => t.occurredAt)).size);
      }

      return {
        id: g.id,
        titulo: g.title,
        metrica: g.metric,
        alvo: fromDbNumeric(g.targetValue),
        atual,
        contaLabel: g.accountId ? labelDaConta(g.accountId) : null,
        prazo: g.deadline,
        concluidaEm: g.achievedAt,
      } satisfies GoalRow;
    });

  // ------------------------------------------------------------- recebimentos
  const recebimentos: AirdropClaimRow[] = claims.map((c) => ({
    id: c.id,
    contaLabel: labelDaConta(c.accountId),
    recebidoEm: c.receivedAt,
    token: c.tokenSymbol,
    quantidade: c.tokenAmount,
    precoUsd: c.priceUsd,
    valor: fromDbNumeric(c.valueUsd),
  }));

  return {
    id: projeto.id,
    slug: projeto.slug,
    nome: projeto.name,
    status: projeto.status,
    chain: projeto.chain,
    prioridade: projeto.priority,
    aportado: financeiro.aportado,
    exposicao: financeiro.exposicao,
    resultado: financeiro.resultado,
    roi: financeiro.roi,
    contas: pares.length,
    tarefasPendentes: pendentes.length,
    tarefasAtrasadas: pendentes.filter((o) => o.dueDate < "2026-07-28").length,
    ultimaAtividade: ultimaAtividade((t) => t.projectId === projeto.id),
    tgePrevisto: projeto.expectedTgeDate,
    links: {
      website: projeto.websiteUrl,
      discord: projeto.discordUrl,
      twitter: projeto.twitterUrl,
      docs: projeto.docsUrl,
    },
    notas: projeto.notes,
    contasDetalhe,
    historico,
    metas,
    recebimentos,
  };
}

export async function listProjectSlugs(): Promise<string[]> {
  return rawProjects.map((p) => p.slug);
}

export { relativeLabel };
