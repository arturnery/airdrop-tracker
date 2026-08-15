import { describe, expect, it } from "vitest";

import { datasetInicial } from "@/db/queries/fixtures";
import { capitalDepositado, capitalDepositadoPorPosicao } from "@/lib/finance";
import { cents, toDbNumeric } from "@/lib/money";
import * as M from "@/lib/mutations";
import {
  selectAccounts,
  selectDashboardSummary,
  selectProjects,
} from "@/lib/selectors";

const HOJE = "2026-07-29";

/**
 * O defeito: `max(0, Σ)` no lugar de `Σ max(0, …)`.
 *
 * O corte em zero do capital depositado existe por posição: sacar mais do que se
 * pôs num projeto significa que ali não sobrou capital próprio. Aplicado ao
 * total geral, o excesso de um projeto virava desconto nos outros, o que não
 * acontece na vida real: sacar demais do projeto A não devolve o dinheiro que
 * está parado no projeto B.
 *
 * Na base real o painel exibia US$ 0 de capital depositado enquanto a tabela
 * logo abaixo somava US$ 3.486, com o mesmo dado.
 */
function comSaqueMaiorQueAporte() {
  let ds = datasetInicial();
  const alvo = ds.projects.find((p) => p.slug === "vertex-perp")!;
  const par = ds.projectAccounts.find((p) => p.projectId === alvo.id)!;

  // Vende o airdrop e saca tudo: entra pouco, sai muito.
  ds = M.criarLancamento(ds, {
    projectId: alvo.id,
    accountId: par.accountId,
    occurredAt: HOJE,
    type: "trade_pnl",
    amount: cents(500000),
    tokenSymbol: null,
    tokenAmount: null,
    description: "venda dos tokens",
  });
  return M.criarLancamento(ds, {
    projectId: alvo.id,
    accountId: par.accountId,
    occurredAt: HOJE,
    type: "withdrawal",
    amount: cents(-500000),
    tokenSymbol: null,
    tokenAmount: null,
    description: "sacou tudo",
  });
}

describe("capital depositado cortado por posição", () => {
  it("o cartão do painel bate com a soma da tabela", () => {
    const ds = comSaqueMaiorQueAporte();

    const cartao = selectDashboardSummary(ds, HOJE).capitalDepositado;
    const tabela = selectProjects(ds, HOJE).reduce(
      (acc, p) => acc + p.capitalDepositado,
      0,
    );

    expect(cartao).toBe(tabela);
  });

  it("o excesso de uma posição não apaga o capital das outras", () => {
    const base = datasetInicial();
    const alvo = base.projects.find((p) => p.slug === "vertex-perp")!;
    const par = base.projectAccounts.find((p) => p.projectId === alvo.id)!;

    /* Cai só o que estava naquela conta daquele projeto, que é a posição
       sacada. O resto do projeto, e os outros projetos, não se mexem: era
       exatamente isso que o corte sobre o total destruía. */
    const daPosicao = capitalDepositadoPorPosicao(
      base.transactions.filter(
        (t) => t.projectId === alvo.id && t.accountId === par.accountId,
      ),
    );

    const antes = selectDashboardSummary(base, HOJE).capitalDepositado;
    const depois = selectDashboardSummary(comSaqueMaiorQueAporte(), HOJE)
      .capitalDepositado;

    expect(daPosicao).toBeGreaterThan(0);
    expect(depois).toBe(antes - daPosicao);
    expect(depois).toBeGreaterThan(0);
  });

  it("continua zero quando não há posição nenhuma com capital", () => {
    expect(toDbNumeric(capitalDepositadoPorPosicao([]))).toBe("0.00");
  });

  it("duas posições no mesmo projeto são cortadas separadamente", () => {
    const mov = (accountId: string, type: string, amountUsd: string) => ({
      projectId: "p1",
      accountId,
      type,
      amountUsd,
    });

    /* A conta a1 sacou 900 tendo posto 100; a a2 tem 300 parados. Somando antes
       de cortar daria max(0, 400 − 900) = 0. Cortando cada uma dá 0 + 300. */
    const total = capitalDepositadoPorPosicao([
      mov("a1", "deposit", "100.00"),
      mov("a1", "withdrawal", "-900.00"),
      mov("a2", "deposit", "300.00"),
    ]);

    expect(toDbNumeric(total)).toBe("300.00");
    expect(
      toDbNumeric(capitalDepositado({ aportado: cents(40000), retirado: cents(-90000) })),
    ).toBe("0.00");
  });

  it("a soma por conta também bate com o painel", () => {
    const ds = comSaqueMaiorQueAporte();
    const painel = selectDashboardSummary(ds, HOJE).capitalDepositado;
    const contas = selectAccounts(ds).reduce((a, c) => a + c.capitalDepositado, 0);
    expect(contas).toBe(painel);
  });

  it("volume operado não conta como capital", () => {
    const total = capitalDepositadoPorPosicao([
      { projectId: "p1", accountId: "a1", type: "deposit", amountUsd: "100.00" },
      { projectId: "p1", accountId: "a1", type: "volume_traded", amountUsd: "50000.00" },
      { projectId: "p1", accountId: "a1", type: "trade_pnl", amountUsd: "70.00" },
    ]);
    expect(toDbNumeric(total)).toBe("100.00");
  });
});
