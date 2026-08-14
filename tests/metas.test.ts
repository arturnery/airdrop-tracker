import { describe, expect, it } from "vitest";

import { datasetInicial } from "@/db/queries/fixtures";
import { cents, toDbNumeric } from "@/lib/money";
import * as M from "@/lib/mutations";
import { selectProjectBySlug } from "@/lib/selectors";

const HOJE = "2026-07-29";
const base = () => datasetInicial();

const metasDe = (ds: ReturnType<typeof base>, slug: string) =>
  selectProjectBySlug(ds, slug, HOJE)!.metas;

/**
 * O caso que motivou a mudança.
 *
 * Antes, o progresso de uma meta era derivado dos lançamentos do projeto: uma
 * meta de volume somava todo o `volume_traded` dali. Funcionava com uma meta e
 * ruía com duas, porque as duas somavam exatamente a mesma coisa. Um projeto
 * com metas de perps, ponte e spot mostrava o mesmo número nas três, que não era
 * o de nenhuma.
 */
describe("metas independentes no mesmo projeto", () => {
  it("duas metas da mesma métrica não compartilham progresso", () => {
    let ds = base();
    const projeto = ds.projects.find((p) => p.slug === "meridian")!;

    ds = M.criarMeta(ds, {
      projectId: projeto.id,
      accountId: null,
      title: "Volume em perps",
      metric: "volume_usd",
      target: cents(500000),
      deadline: null,
    });
    ds = M.criarMeta(ds, {
      projectId: projeto.id,
      accountId: null,
      title: "Volume em ponte",
      metric: "volume_usd",
      target: cents(500000),
      deadline: null,
    });

    const [perps, ponte] = metasDe(ds, "meridian").slice(-2);
    ds = M.lancarProgressoMeta(ds, {
      goalId: perps!.id,
      occurredAt: HOJE,
      value: cents(120000),
      note: null,
    });

    const depois = metasDe(ds, "meridian");
    const perpsDepois = depois.find((m) => m.id === perps!.id)!;
    const ponteDepois = depois.find((m) => m.id === ponte!.id)!;

    expect(toDbNumeric(perpsDepois.atual)).toBe("1200.00");
    // A outra meta não se mexe: é o que o modelo derivado não conseguia fazer.
    expect(toDbNumeric(ponteDepois.atual)).toBe("0.00");
  });

  it("lançamentos somam em vez de substituir", () => {
    let ds = base();
    const meta = metasDe(ds, "vertex-perp")[0]!;
    const antes = meta.atual;

    ds = M.lancarProgressoMeta(ds, {
      goalId: meta.id,
      occurredAt: HOJE,
      value: cents(50000),
      note: "mais uma semana",
    });

    expect(metasDe(ds, "vertex-perp")[0]!.atual).toBe(antes + 50000);
  });

  it("valor negativo corrige um lançamento a mais", () => {
    let ds = base();
    const meta = metasDe(ds, "vertex-perp")[0]!;
    const antes = meta.atual;

    ds = M.lancarProgressoMeta(ds, {
      goalId: meta.id,
      occurredAt: HOJE,
      value: cents(-30000),
      note: "lancei duas vezes",
    });

    expect(metasDe(ds, "vertex-perp")[0]!.atual).toBe(antes - 30000);
  });

  it("o volume do projeto deixou de mexer no progresso da meta", () => {
    let ds = base();
    const projeto = ds.projects.find((p) => p.slug === "vertex-perp")!;
    const par = ds.projectAccounts.find((p) => p.projectId === projeto.id)!;
    const antes = metasDe(ds, "vertex-perp")[0]!.atual;

    ds = M.criarLancamento(ds, {
      projectId: projeto.id,
      accountId: par.accountId,
      occurredAt: HOJE,
      type: "volume_traded",
      amount: cents(900000),
      tokenSymbol: null,
      tokenAmount: null,
      description: null,
    });

    expect(metasDe(ds, "vertex-perp")[0]!.atual).toBe(antes);
  });

  it("excluir o lançamento devolve o progresso anterior", () => {
    let ds = base();
    const meta = metasDe(ds, "vertex-perp")[0]!;
    const antes = meta.atual;

    ds = M.lancarProgressoMeta(ds, {
      goalId: meta.id,
      occurredAt: HOJE,
      value: cents(70000),
      note: null,
    });
    const criado = metasDe(ds, "vertex-perp")[0]!.lancamentos[0]!;
    ds = M.excluirProgressoMeta(ds, criado.id);

    expect(metasDe(ds, "vertex-perp")[0]!.atual).toBe(antes);
  });

  it("excluir a meta leva o progresso dela junto", () => {
    let ds = base();
    const meta = metasDe(ds, "vertex-perp")[0]!;
    expect(ds.goalEntries.filter((e) => e.goalId === meta.id).length).toBeGreaterThan(0);

    ds = M.excluirMeta(ds, meta.id);

    // Sem isso, o progresso ficaria órfão somando em tabela nenhuma.
    expect(ds.goalEntries.filter((e) => e.goalId === meta.id)).toHaveLength(0);
  });

  it("excluir o projeto leva metas e progresso, em cascata de dois níveis", () => {
    let ds = base();
    const projeto = ds.projects.find((p) => p.slug === "vertex-perp")!;
    const idsMetas = ds.goals
      .filter((g) => g.projectId === projeto.id)
      .map((g) => g.id);

    ds = M.excluirProjeto(ds, projeto.id);

    expect(ds.goals.filter((g) => g.projectId === projeto.id)).toHaveLength(0);
    expect(ds.goalEntries.filter((e) => idsMetas.includes(e.goalId))).toHaveLength(0);
  });
});
