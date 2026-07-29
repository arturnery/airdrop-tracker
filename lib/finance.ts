import { addCents, cents, fromDbNumeric, percentOf, ZERO, type Cents } from "./money";
import type { FinancialSummary, IsoDate } from "./types";

/**
 * Agregação financeira. Módulo puro: recebe linhas no formato que o banco
 * devolve e devolve totais. Sem Drizzle, sem React — testável direto.
 *
 * As fórmulas estão em ARCHITECTURE.md §5.
 */

export type MovementRow = {
  projectId: string;
  accountId: string;
  type: string;
  amountUsd: string;
};

export type SnapshotRow = {
  projectId: string;
  accountId: string;
  takenAt: IsoDate;
  balanceUsd: string;
};

export type PairKey = string;

export const pairKey = (projectId: string, accountId: string): PairKey =>
  `${projectId}::${accountId}`;

/**
 * Último snapshot de cada par projeto×conta.
 * Só o mais recente vale — snapshot é foto, não fluxo (ARCHITECTURE.md §2.2).
 */
export function latestSnapshotByPair(
  snapshots: SnapshotRow[],
): Map<PairKey, { balance: Cents; takenAt: IsoDate }> {
  const result = new Map<PairKey, { balance: Cents; takenAt: IsoDate }>();
  for (const snap of snapshots) {
    const key = pairKey(snap.projectId, snap.accountId);
    const current = result.get(key);
    // Datas ISO comparam corretamente como string.
    if (!current || snap.takenAt > current.takenAt) {
      result.set(key, {
        balance: fromDbNumeric(snap.balanceUsd),
        takenAt: snap.takenAt,
      });
    }
  }
  return result;
}

/** Soma um tipo de movimento por par. `volume_traded` nunca entra em caixa. */
export function sumByPair(
  movements: MovementRow[],
  types: readonly string[],
): Map<PairKey, Cents> {
  const result = new Map<PairKey, Cents>();
  for (const mov of movements) {
    if (!types.includes(mov.type)) continue;
    const key = pairKey(mov.projectId, mov.accountId);
    const previous = result.get(key) ?? ZERO;
    result.set(key, addCents(previous, fromDbNumeric(mov.amountUsd)));
  }
  return result;
}

export function sumOfType(movements: MovementRow[], type: string): Cents {
  return cents(
    movements
      .filter((m) => m.type === type)
      .reduce<number>((acc, m) => acc + fromDbNumeric(m.amountUsd), 0),
  );
}

export type PairExposure = {
  value: Cents;
  /** true = veio de snapshot; false = estimado pelo aporte líquido. */
  confirmed: boolean;
  takenAt: IsoDate | null;
};

/**
 * Exposição de um par projeto×conta.
 *
 * Com snapshot, usa o snapshot. Sem snapshot, estima pelo aporte líquido —
 * o dinheiro foi depositado e não foi retirado, então essa é a melhor
 * informação disponível. Tratar como zero produziria prejuízo fictício de
 * 100% em todo projeto recém-aportado.
 *
 * `confirmed` propaga a diferença até a interface, que mostra a cobertura
 * ("N de M contas com saldo confirmado") em vez de fingir precisão.
 */
export function exposureForPair(
  key: PairKey,
  snapshots: Map<PairKey, { balance: Cents; takenAt: IsoDate }>,
  netFlow: Map<PairKey, Cents>,
): PairExposure {
  const snapshot = snapshots.get(key);
  if (snapshot) {
    return { value: snapshot.balance, confirmed: true, takenAt: snapshot.takenAt };
  }
  return { value: netFlow.get(key) ?? ZERO, confirmed: false, takenAt: null };
}

/** Movimentos que afetam o saldo dentro da plataforma. */
const CASH_TYPES = ["deposit", "withdrawal", "trade_pnl"] as const;

export function netFlowByPair(movements: MovementRow[]): Map<PairKey, Cents> {
  return sumByPair(movements, CASH_TYPES);
}

export type SummaryInput = {
  movements: MovementRow[];
  snapshots: SnapshotRow[];
  /** Pares ativos. Um par pode existir sem movimento (conta recém-vinculada). */
  pairs: { projectId: string; accountId: string }[];
  airdropsUsd?: string[];
};

export function summarizeFinancials(input: SummaryInput): FinancialSummary & {
  paresComSaldo: number;
  paresTotal: number;
} {
  const { movements, snapshots, pairs, airdropsUsd = [] } = input;

  const aportado = sumOfType(movements, "deposit");
  const retirado = sumOfType(movements, "withdrawal");
  const taxas = sumOfType(movements, "fee_gas");
  const pnlTrades = sumOfType(movements, "trade_pnl");
  const airdrops = cents(
    airdropsUsd.reduce<number>((acc, v) => acc + fromDbNumeric(v), 0),
  );

  const snapshotMap = latestSnapshotByPair(snapshots);
  const netMap = netFlowByPair(movements);

  let exposicao = ZERO;
  let paresComSaldo = 0;
  for (const pair of pairs) {
    const key = pairKey(pair.projectId, pair.accountId);
    const exposure = exposureForPair(key, snapshotMap, netMap);
    exposicao = addCents(exposicao, exposure.value);
    if (exposure.confirmed) paresComSaldo += 1;
  }

  // Resultado = (retirado + exposição + airdrops) − aportado − |taxas|
  const resultado = cents(
    retirado + exposicao + airdrops - aportado - Math.abs(taxas),
  );

  return {
    aportado,
    retirado,
    taxas,
    pnlTrades,
    airdrops,
    exposicao,
    resultado,
    roi: percentOf(resultado, aportado),
    paresComSaldo,
    paresTotal: pairs.length,
  };
}
