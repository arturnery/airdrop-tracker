import "server-only";

import {
  exposureForPair,
  latestSnapshotByPair,
  netFlowByPair,
  pairKey,
  type PairExposure,
} from "@/lib/finance";
import { addCents, ZERO, type Cents } from "@/lib/money";

import {
  rawBalanceSnapshots,
  rawProjectAccounts,
  rawTransactions,
} from "./fixtures";

/**
 * Cálculos reaproveitados por mais de uma query. Isolados aqui para que
 * dashboard, projetos e contas nunca divirjam no mesmo número.
 */

export function snapshotMap() {
  return latestSnapshotByPair(rawBalanceSnapshots);
}

export function netFlowMap() {
  return netFlowByPair(rawTransactions);
}

export function exposicaoDoPar(projectId: string, accountId: string): PairExposure {
  return exposureForPair(pairKey(projectId, accountId), snapshotMap(), netFlowMap());
}

/** Exposição somada por projeto. */
export function exposicaoPorProjeto(): Map<string, Cents> {
  const snaps = snapshotMap();
  const net = netFlowMap();
  const result = new Map<string, Cents>();

  for (const par of rawProjectAccounts) {
    const exposure = exposureForPair(pairKey(par.projectId, par.accountId), snaps, net);
    const atual = result.get(par.projectId) ?? ZERO;
    result.set(par.projectId, addCents(atual, exposure.value));
  }
  return result;
}

/** Exposição somada por conta, atravessando todos os projetos. */
export function exposicaoPorConta(): Map<string, Cents> {
  const snaps = snapshotMap();
  const net = netFlowMap();
  const result = new Map<string, Cents>();

  for (const par of rawProjectAccounts) {
    const exposure = exposureForPair(pairKey(par.projectId, par.accountId), snaps, net);
    const atual = result.get(par.accountId) ?? ZERO;
    result.set(par.accountId, addCents(atual, exposure.value));
  }
  return result;
}

/** Data do movimento mais recente de um filtro qualquer. */
export function ultimaAtividade(
  filtro: (t: (typeof rawTransactions)[number]) => boolean,
): string | null {
  const datas = rawTransactions.filter(filtro).map((t) => t.occurredAt);
  const snaps = rawBalanceSnapshots
    .filter((s) =>
      filtro({
        id: s.id,
        projectId: s.projectId,
        accountId: s.accountId,
        occurredAt: s.takenAt,
        type: "other",
        amountUsd: s.balanceUsd,
        description: null,
      }),
    )
    .map((s) => s.takenAt);

  const todas = [...datas, ...snaps];
  if (todas.length === 0) return null;
  return todas.reduce((maior, atual) => (atual > maior ? atual : maior));
}
