import "server-only";

import { daysBetween, urgencyOf } from "@/lib/dates";
import type { TaskOccurrenceRow } from "@/lib/types";

import {
  HOJE,
  rawAccounts,
  rawProjects,
  rawTaskOccurrences,
  rawTasks,
} from "./fixtures";

/**
 * Ocorrências de tarefa.
 *
 * Na fase 4 estas linhas passam a ser materializadas pelo motor de recorrência
 * (`lib/recurrence.ts`) em vez de virem prontas das fixtures. O formato de
 * saída já é o definitivo.
 */

function montarLinha(
  occ: (typeof rawTaskOccurrences)[number],
): TaskOccurrenceRow | null {
  const tarefa = rawTasks.find((t) => t.id === occ.taskId);
  if (!tarefa || !tarefa.isActive) return null;

  const projeto = rawProjects.find((p) => p.id === tarefa.projectId);
  if (!projeto) return null;

  return {
    id: occ.id,
    titulo: tarefa.title,
    descricao: tarefa.description,
    projetoSlug: projeto.slug,
    projetoNome: projeto.name,
    contaLabel:
      rawAccounts.find((a) => a.id === occ.accountId)?.label ?? "conta removida",
    vencimento: occ.dueDate,
    recorrencia: tarefa.recurrence,
    concluida: occ.completedAt !== null,
    urgencia: urgencyOf(occ.dueDate, HOJE),
    diasRestantes: daysBetween(HOJE, occ.dueDate),
  };
}

/** Pendentes, das atrasadas para as futuras. */
export async function listPendingTasks(): Promise<TaskOccurrenceRow[]> {
  return rawTaskOccurrences
    .filter((o) => !o.completedAt && !o.skipped)
    .map(montarLinha)
    .filter((row): row is TaskOccurrenceRow => row !== null)
    .sort(
      (a, b) =>
        a.vencimento.localeCompare(b.vencimento) ||
        a.projetoNome.localeCompare(b.projetoNome) ||
        a.contaLabel.localeCompare(b.contaLabel),
    );
}

/** Concluídas hoje — realimenta a sensação de progresso no painel. */
export async function listCompletedToday(): Promise<TaskOccurrenceRow[]> {
  return rawTaskOccurrences
    .filter((o) => o.completedAt !== null && o.dueDate === HOJE)
    .map(montarLinha)
    .filter((row): row is TaskOccurrenceRow => row !== null);
}

export async function listTasksByProject(
  projectId: string,
): Promise<TaskOccurrenceRow[]> {
  const ids = rawTasks.filter((t) => t.projectId === projectId).map((t) => t.id);
  return rawTaskOccurrences
    .filter((o) => ids.includes(o.taskId) && !o.completedAt && !o.skipped)
    .map(montarLinha)
    .filter((row): row is TaskOccurrenceRow => row !== null)
    .sort((a, b) => a.vencimento.localeCompare(b.vencimento));
}

export { HOJE };
