import "server-only";

import { sumOfType } from "@/lib/finance";
import { subtractCents, ZERO } from "@/lib/money";
import type { AccountSummary } from "@/lib/types";

import {
  rawAccounts,
  rawProjectAccounts,
  rawTaskOccurrences,
  rawTransactions,
} from "./fixtures";
import { exposicaoPorConta, ultimaAtividade } from "./shared";

/**
 * Visão por conta atravessando todos os projetos.
 *
 * É o que a planilha não conseguia responder: a conta era texto repetido em
 * cada linha, então não havia como somar "quanto a brave tem espalhado".
 */
export async function listAccounts(): Promise<AccountSummary[]> {
  const exposicoes = exposicaoPorConta();

  return rawAccounts
    .map((conta) => {
      const movimentos = rawTransactions.filter((t) => t.accountId === conta.id);
      const aportado = sumOfType(movimentos, "deposit");
      const exposicao = exposicoes.get(conta.id) ?? ZERO;

      return {
        id: conta.id,
        label: conta.label,
        endereco: conta.walletAddress,
        email: conta.email,
        ativa: conta.isActive,
        projetos: rawProjectAccounts.filter((p) => p.accountId === conta.id).length,
        aportado,
        exposicao,
        resultado: subtractCents(exposicao, aportado),
        tarefasPendentes: rawTaskOccurrences.filter(
          (o) => o.accountId === conta.id && !o.completedAt && !o.skipped,
        ).length,
        ultimaAtividade: ultimaAtividade((t) => t.accountId === conta.id),
      } satisfies AccountSummary;
    })
    .sort((a, b) => b.aportado - a.aportado);
}
