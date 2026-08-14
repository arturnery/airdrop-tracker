import { describe, expect, it } from "vitest";

import { datasetInicial } from "@/db/queries/fixtures";
import * as M from "@/lib/mutations";
import {
  selectAccounts,
  selectDashboardSummary,
  selectProjectBySlug,
  selectProjects,
} from "@/lib/selectors";

const HOJE = "2026-07-29";

/**
 * O defeito que estes testes travam: o airdrop recebido entrava no resultado da
 * aba do projeto e não entrava no das listas. O mesmo projeto aparecia positivo
 * numa tela e negativo na outra, e de fora nenhuma das duas parecia errada.
 *
 * A causa foi a fórmula morar em dois lugares. A aba chamava
 * `summarizeFinancials`, que soma o airdrop; as listas montavam
 * `resultadoLiquido` à mão e esqueciam o argumento, que é opcional. Por isso os
 * testes comparam **telas entre si** em vez de conferir um número absoluto:
 * o erro não era o valor estar errado, era ele divergir conforme onde se olha.
 */
function comAirdropDe(valorEmDolar: number) {
  const base = datasetInicial();
  const projeto = base.projects.find((p) => p.slug === "vertex-perp")!;
  const par = base.projectAccounts.find((p) => p.projectId === projeto.id)!;

  return {
    ds: M.registrarRecebimento(base, {
      projectId: projeto.id,
      accountId: par.accountId,
      receivedAt: HOJE,
      tokenSymbol: "VTX",
      tokenAmount: String(valorEmDolar),
      priceUsd: "1",
    }),
    slug: projeto.slug,
    projectId: projeto.id,
    accountId: par.accountId,
  };
}

describe("airdrop recebido no resultado", () => {
  it("a lista de projetos concorda com a aba do projeto", () => {
    const { ds, slug } = comAirdropDe(5000);

    const naLista = selectProjects(ds, HOJE).find((p) => p.slug === slug)!;
    const naAba = selectProjectBySlug(ds, slug, HOJE)!;

    expect(naLista.resultado).toBe(naAba.resultado);
  });

  it("recebimento maior melhora o resultado da lista, e não só o da aba", () => {
    const semNada = selectProjects(datasetInicial(), HOJE).find(
      (p) => p.slug === "vertex-perp",
    )!;
    const { ds, slug } = comAirdropDe(5000);
    const comAirdrop = selectProjects(ds, HOJE).find((p) => p.slug === slug)!;

    expect(comAirdrop.resultado - semNada.resultado).toBe(500000);
  });

  it("a lista de contas concorda com as contas dentro da aba", () => {
    const { ds, slug, accountId } = comAirdropDe(3000);

    const naLista = selectAccounts(ds).find((c) => c.id === accountId)!;
    const naAba = selectProjectBySlug(ds, slug, HOJE)!.contasDetalhe.find(
      (c) => c.contaId === accountId,
    )!;

    /* A conta pode participar de outros projetos, então os dois números não são
       iguais: o da lista cobre tudo. O que se exige é que ambos tenham subido
       com o recebimento, que é o que não acontecia. */
    const semNada = selectAccounts(datasetInicial()).find(
      (c) => c.id === accountId,
    )!;
    expect(naLista.resultado - semNada.resultado).toBe(300000);
    expect(naAba.resultado).toBeGreaterThan(0);
  });

  it("o total do painel continua batendo com a soma dos projetos", () => {
    const { ds } = comAirdropDe(5000);

    const painel = selectDashboardSummary(ds, HOJE);
    const soma = selectProjects(ds, HOJE).reduce((acc, p) => acc + p.resultado, 0);

    expect(painel.resultado).toBe(soma);
  });
});
