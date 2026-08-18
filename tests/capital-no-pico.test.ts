import { describe, expect, it } from "vitest";

import { datasetInicial } from "@/db/queries/fixtures";
import { capitalNoPico } from "@/lib/finance";
import { cents, toDbNumeric } from "@/lib/money";
import * as M from "@/lib/mutations";
import { selectDashboardSummary, selectProjects } from "@/lib/selectors";

const HOJE = "2026-07-29";

const mov = (
  accountId: string,
  type: string,
  amountUsd: string,
  occurredAt: string,
  projectId = "p1",
) => ({ projectId, accountId, occurredAt, type, amountUsd });

/**
 * A base do ROI: o máximo do dinheiro próprio empregado ao mesmo tempo.
 *
 * Substituiu "depósitos menos saques, com piso em zero", que zerava justamente
 * nos projetos que deram certo: sacar é sacar principal **e** lucro juntos,
 * então quem pôs US$ 220 e tirou US$ 7.506 ficava com base zero e sem ROI.
 *
 * A alternativa óbvia, somar os depósitos, tem o defeito oposto: infla quando o
 * mesmo dinheiro é reciclado.
 */
describe("capital no pico", () => {
  it("posição simples: o pico é o que foi depositado", () => {
    expect(
      toDbNumeric(capitalNoPico([mov("a1", "deposit", "100.00", "2026-07-01")])),
    ).toBe("100.00");
  });

  it("reciclar o mesmo dinheiro não dobra o pico", () => {
    const total = capitalNoPico([
      mov("a1", "deposit", "100.00", "2026-07-01"),
      mov("a1", "withdrawal", "-100.00", "2026-07-02"),
      mov("a1", "deposit", "100.00", "2026-07-03"),
    ]);
    // A soma dos depósitos daria 200. Nunca houve mais de 100 empregado.
    expect(toDbNumeric(total)).toBe("100.00");
  });

  it("reciclar entre projetos diferentes também não dobra", () => {
    const total = capitalNoPico([
      mov("a1", "deposit", "100.00", "2026-07-01", "p1"),
      mov("a1", "withdrawal", "-100.00", "2026-07-02", "p1"),
      mov("a1", "deposit", "100.00", "2026-07-03", "p2"),
    ]);
    expect(toDbNumeric(total)).toBe("100.00");
  });

  it("depósitos que convivem somam", () => {
    const total = capitalNoPico([
      mov("a1", "deposit", "100.00", "2026-07-01", "p1"),
      mov("a2", "deposit", "300.00", "2026-07-02", "p2"),
    ]);
    expect(toDbNumeric(total)).toBe("400.00");
  });

  it("sacar mais do que se pôs não vira crédito na outra posição", () => {
    /*
     * a1 saca 900 tendo posto 100: o excedente é lucro, não capital devolvido.
     * Sem o piso por posição, esses 800 apagariam os 300 parados em a2, e o
     * pico sairia menor do que o que esteve empregado de verdade.
     */
    const total = capitalNoPico([
      mov("a1", "deposit", "100.00", "2026-07-01"),
      mov("a2", "deposit", "300.00", "2026-07-02"),
      mov("a1", "withdrawal", "-900.00", "2026-07-03"),
    ]);
    expect(toDbNumeric(total)).toBe("400.00");
  });

  it("o pico é o máximo da história, não o de agora", () => {
    const total = capitalNoPico([
      mov("a1", "deposit", "500.00", "2026-07-01"),
      mov("a1", "withdrawal", "-400.00", "2026-07-02"),
    ]);
    // Hoje há 100 empregados; o ROI compara com os 500 que já estiveram.
    expect(toDbNumeric(total)).toBe("500.00");
  });

  it("a ordem vem da data, não da ordem do array", () => {
    const desordenado = capitalNoPico([
      mov("a1", "deposit", "100.00", "2026-07-03"),
      mov("a1", "withdrawal", "-100.00", "2026-07-02"),
      mov("a1", "deposit", "100.00", "2026-07-01"),
    ]);
    expect(toDbNumeric(desordenado)).toBe("100.00");
  });

  it("volume, taxa e trade não são capital empregado", () => {
    const total = capitalNoPico([
      mov("a1", "deposit", "100.00", "2026-07-01"),
      mov("a1", "volume_traded", "50000.00", "2026-07-02"),
      mov("a1", "trade_pnl", "700.00", "2026-07-03"),
      mov("a1", "fee_gas", "-5.00", "2026-07-04"),
    ]);
    expect(toDbNumeric(total)).toBe("100.00");
  });

  it("sem lançamento nenhum vale zero", () => {
    expect(toDbNumeric(capitalNoPico([]))).toBe("0.00");
  });
});

describe("o pico como base do ROI, no dataset completo", () => {
  it("sacar tudo com lucro mantém o ROI, que antes desaparecia", () => {
    let ds = datasetInicial();
    const alvo = ds.projects.find((p) => p.slug === "vertex-perp")!;
    const par = ds.projectAccounts.find((p) => p.projectId === alvo.id)!;

    const antes = selectProjects(ds, HOJE).find((p) => p.slug === alvo.slug)!;
    expect(antes.roi).not.toBeNull();

    ds = M.criarLancamento(ds, {
      projectId: alvo.id,
      accountId: par.accountId,
      occurredAt: HOJE,
      type: "trade_pnl",
      amount: cents(500000),
      tokenSymbol: null,
      tokenAmount: null,
      description: "vendeu o airdrop",
    });
    ds = M.criarLancamento(ds, {
      projectId: alvo.id,
      accountId: par.accountId,
      occurredAt: HOJE,
      type: "withdrawal",
      amount: cents(-500000),
      tokenSymbol: null,
      tokenAmount: null,
      description: "sacou tudo",
    });

    const depois = selectProjects(ds, HOJE).find((p) => p.slug === alvo.slug)!;
    // A base não se mexe: o pico já aconteceu, e sacar não o desfaz.
    expect(depois.capitalNoPico).toBe(antes.capitalNoPico);
    expect(depois.roi).not.toBeNull();
    expect(depois.resultado).toBeGreaterThan(antes.resultado);
  });

  it("o painel usa o pico da carteira, não a soma dos picos por projeto", () => {
    const ds = datasetInicial();
    const painel = selectDashboardSummary(ds, HOJE).capitalNoPico;
    const soma = selectProjects(ds, HOJE).reduce((a, p) => a + p.capitalNoPico, 0);

    /*
     * Os dois podem divergir de propósito, e é por isso que a tela não os exibe
     * lado a lado: o pico de um projeto foi num mês e o do outro noutro, e a
     * carteira nunca teve os dois ao mesmo tempo. O painel nunca pode passar da
     * soma, que é o limite superior.
     */
    expect(painel).toBeLessThanOrEqual(soma);
    expect(painel).toBeGreaterThan(0);
  });
});
