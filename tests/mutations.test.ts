import { describe, expect, it } from "vitest";

import { datasetInicial } from "@/db/queries/fixtures";
import * as M from "@/lib/mutations";
import { cents, toDbNumeric } from "@/lib/money";
import { selectDashboardSummary, selectProjectBySlug } from "@/lib/selectors";

const base = () => datasetInicial();
const HOJE = "2026-07-29";

describe("criação", () => {
  it("gera slug único ao criar projeto com nome repetido", () => {
    const { dataset, id } = M.criarProjeto(base(), {
      name: "Nansen",
      status: "ativo",
      chain: null,
      priority: 3,
      websiteUrl: null,
      discordUrl: null,
      twitterUrl: null,
      docsUrl: null,
      expectedTgeDate: null,
      notes: null,
    });
    const criado = dataset.projects.find((p) => p.id === id)!;
    expect(criado.slug).toBe("nansen-2");
  });

  it("vincula a conta ao projeto ao lançar em par inexistente", () => {
    // acc-mbox nunca farmou Lighter.
    const ds = M.criarLancamento(base(), {
      projectId: "prj-lighter",
      accountId: "acc-mbox",
      occurredAt: HOJE,
      type: "deposit",
      amount: cents(5000),
      description: null,
    });
    const par = ds.projectAccounts.find(
      (p) => p.projectId === "prj-lighter" && p.accountId === "acc-mbox",
    );
    expect(par).toBeDefined();
    expect(par?.startedAt).toBe(HOJE);
  });

  it("não duplica vínculo existente", () => {
    const antes = base().projectAccounts.length;
    const ds = M.vincularConta(base(), {
      projectId: "prj-nansen",
      accountId: "acc-brave",
      status: "ativa",
      startedAt: HOJE,
    });
    expect(ds.projectAccounts).toHaveLength(antes);
  });

  it("substitui o saldo do mesmo par no mesmo dia em vez de duplicar", () => {
    let ds = M.registrarSaldo(base(), {
      projectId: "prj-saturn",
      accountId: "acc-mbox",
      takenAt: HOJE,
      balance: cents(9000),
    });
    ds = M.registrarSaldo(ds, {
      projectId: "prj-saturn",
      accountId: "acc-mbox",
      takenAt: HOJE,
      balance: cents(9500),
    });
    const doDia = ds.balanceSnapshots.filter(
      (s) =>
        s.projectId === "prj-saturn" &&
        s.accountId === "acc-mbox" &&
        s.takenAt === HOJE,
    );
    expect(doDia).toHaveLength(1);
    expect(doDia[0]?.balanceUsd).toBe("95.00");
  });

  it("expande tarefa sem conta para todas as contas do projeto", () => {
    const ds = M.criarTarefa(
      base(),
      {
        projectId: "prj-ondo",
        accountId: null,
        title: "Nova rotina",
        description: null,
        recurrence: "daily",
        intervalDays: null,
        dueDate: null,
      },
      HOJE,
    );
    const tarefa = ds.tasks.find((t) => t.title === "Nova rotina")!;
    const ocorrencias = ds.taskOccurrences.filter((o) => o.taskId === tarefa.id);
    // Ondo Perp tem 4 contas vinculadas.
    expect(ocorrencias).toHaveLength(4);
    expect(ocorrencias.every((o) => o.dueDate === HOJE)).toBe(true);
  });

  it("congela o valor do airdrop no momento do registro", () => {
    const ds = M.registrarRecebimento(base(), {
      projectId: "prj-ondo",
      accountId: "acc-brave",
      receivedAt: HOJE,
      tokenSymbol: "ondo",
      tokenAmount: "1250",
      priceUsd: "0.42",
    });
    const claim = ds.airdropClaims[0]!;
    expect(claim.tokenSymbol).toBe("ONDO");
    expect(claim.valueUsd).toBe("525.00");
  });
});

describe("exclusão em cascata", () => {
  it("apagar projeto leva junto tudo que dependia dele", () => {
    const ds = M.excluirProjeto(base(), "prj-ondo");

    expect(ds.projects.find((p) => p.id === "prj-ondo")).toBeUndefined();
    expect(ds.projectAccounts.filter((p) => p.projectId === "prj-ondo")).toHaveLength(0);
    expect(ds.transactions.filter((t) => t.projectId === "prj-ondo")).toHaveLength(0);
    expect(ds.balanceSnapshots.filter((s) => s.projectId === "prj-ondo")).toHaveLength(0);
    expect(ds.goals.filter((g) => g.projectId === "prj-ondo")).toHaveLength(0);

    // Nenhuma ocorrência órfã: as tarefas do projeto sumiram com elas.
    const idsRestantes = new Set(ds.tasks.map((t) => t.id));
    expect(ds.taskOccurrences.every((o) => idsRestantes.has(o.taskId))).toBe(true);
  });

  it("o total geral cai exatamente o que o projeto tinha", () => {
    const antes = selectDashboardSummary(base(), HOJE);
    const depois = selectDashboardSummary(M.excluirProjeto(base(), "prj-saturn"), HOJE);
    // Saturn tinha $100 aportados e nenhum outro projeto é afetado.
    expect(toDbNumeric(antes.aportado)).toBe("242.00");
    expect(toDbNumeric(depois.aportado)).toBe("142.00");
    expect(depois.paresTotal).toBe(antes.paresTotal - 1);
  });

  it("apagar conta remove seus movimentos sem deixar par órfão", () => {
    const ds = M.excluirConta(base(), "acc-chrome");

    expect(ds.accounts.find((a) => a.id === "acc-chrome")).toBeUndefined();
    expect(ds.transactions.filter((t) => t.accountId === "acc-chrome")).toHaveLength(0);
    expect(ds.projectAccounts.filter((p) => p.accountId === "acc-chrome")).toHaveLength(0);

    // Todo par restante aponta para conta que existe.
    const idsContas = new Set(ds.accounts.map((a) => a.id));
    expect(ds.projectAccounts.every((p) => idsContas.has(p.accountId))).toBe(true);
  });

  it("tarefa específica de uma conta apagada vira tarefa de todas", () => {
    // tsk-03 é do Lighter e específica de acc-chrome.
    const ds = M.excluirConta(base(), "acc-chrome");
    const tarefa = ds.tasks.find((t) => t.id === "tsk-03")!;
    expect(tarefa.accountId).toBeNull();
  });

  it("desvincular conta remove só os movimentos daquele par", () => {
    const ds = M.desvincularConta(base(), "prj-ondo", "acc-chrome");

    // Somem os de Ondo Perp com chrome...
    expect(
      ds.transactions.filter(
        (t) => t.projectId === "prj-ondo" && t.accountId === "acc-chrome",
      ),
    ).toHaveLength(0);
    // ...mas chrome continua em Lighter.
    expect(
      ds.transactions.filter(
        (t) => t.projectId === "prj-lighter" && t.accountId === "acc-chrome",
      ),
    ).toHaveLength(2);
  });

  it("apagar tarefa remove suas ocorrências", () => {
    const ds = M.excluirTarefa(base(), "tsk-01");
    expect(ds.taskOccurrences.filter((o) => o.taskId === "tsk-01")).toHaveLength(0);
    expect(ds.tasks.find((t) => t.id === "tsk-01")).toBeUndefined();
  });

  it("apagar o único saldo faz a conta voltar a ser estimada", () => {
    const antes = selectProjectBySlug(base(), "lighter", HOJE)!;
    expect(antes.contasDetalhe[0]?.saldo).not.toBeNull();

    const ds = M.excluirSaldo(base(), "snp-11");
    const depois = selectProjectBySlug(ds, "lighter", HOJE)!;
    expect(depois.contasDetalhe[0]?.saldo).toBeNull();
    // Sem snapshot, a exposição passa a ser o aporte líquido.
    expect(toDbNumeric(depois.exposicao)).toBe("20.00");
  });
});

describe("edição", () => {
  it("preserva o slug ao renomear o projeto", () => {
    const ds = M.atualizarProjeto(base(), "prj-ondo", { name: "Ondo Perpétuos" });
    const projeto = ds.projects.find((p) => p.id === "prj-ondo")!;
    expect(projeto.name).toBe("Ondo Perpétuos");
    expect(projeto.slug).toBe("ondo-perp");
  });

  it("recalcula os totais depois de corrigir um lançamento", () => {
    const ds = M.atualizarLancamento(base(), "tx-12", {
      occurredAt: "2026-07-28",
      type: "deposit",
      amount: cents(5000),
      description: "Valor corrigido",
    });
    const resumo = selectDashboardSummary(ds, HOJE);
    // Saturn era $100; virou $50.
    expect(toDbNumeric(resumo.aportado)).toBe("192.00");
  });

  it("tarefa inativa some das pendências sem apagar o registro", () => {
    const ds = M.atualizarTarefa(base(), "tsk-01", { isActive: false });
    const resumo = selectDashboardSummary(ds, HOJE);
    const antes = selectDashboardSummary(base(), HOJE);
    expect(ds.tasks.find((t) => t.id === "tsk-01")).toBeDefined();
    expect(resumo.tarefasAtrasadas).toBeLessThan(antes.tarefasAtrasadas);
  });
});

describe("imutabilidade", () => {
  it("não altera o dataset original", () => {
    const original = base();
    const copia = JSON.stringify(original);
    M.excluirProjeto(original, "prj-ondo");
    M.criarLancamento(original, {
      projectId: "prj-ondo",
      accountId: "acc-brave",
      occurredAt: HOJE,
      type: "deposit",
      amount: cents(100),
      description: null,
    });
    expect(JSON.stringify(original)).toBe(copia);
  });
});
