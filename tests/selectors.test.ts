import { describe, expect, it } from "vitest";

import { datasetInicial, HOJE } from "@/db/queries/fixtures";
import { novoId, slugify, uniqueSlug } from "@/lib/dataset";
import { toDbNumeric } from "@/lib/money";
import {
  selectAccounts,
  selectCapitalPorProjeto,
  selectDashboardSummary,
  selectPendingTasks,
  selectProjectBySlug,
  selectProjects,
} from "@/lib/selectors";

const ds = datasetInicial();

describe("selectDashboardSummary", () => {
  const resumo = selectDashboardSummary(ds, HOJE);

  it("soma o capital aportado da planilha", () => {
    expect(toDbNumeric(resumo.aportado)).toBe("242.00");
  });

  it("calcula exposição e resultado", () => {
    expect(toDbNumeric(resumo.exposicao)).toBe("253.18");
    expect(toDbNumeric(resumo.resultado)).toBe("11.18");
    expect(resumo.roi).toBe(4.6);
  });

  it("reporta a cobertura de saldo confirmado", () => {
    // Saturn/mbox tem aporte mas nenhum snapshot.
    expect(resumo.paresComSaldo).toBe(10);
    expect(resumo.paresTotal).toBe(11);
  });

  it("conta contas e projetos ativos", () => {
    expect(resumo.projetosAtivos).toBe(5);
    expect(resumo.contasAtivas).toBe(6);
  });
});

describe("selectProjects", () => {
  const projetos = selectProjects(ds, HOJE);

  it("ordena por prioridade", () => {
    expect(projetos[0]?.nome).toBe("Ondo Perp");
    expect(projetos[0]?.prioridade).toBe(5);
  });

  it("calcula o resultado de cada projeto", () => {
    const porNome = Object.fromEntries(projetos.map((p) => [p.nome, p]));
    expect(toDbNumeric(porNome["Ondo Perp"]!.aportado)).toBe("70.00");
    expect(toDbNumeric(porNome["Ondo Perp"]!.resultado)).toBe("4.40");
    expect(toDbNumeric(porNome["Nansen"]!.resultado)).toBe("8.33");
    expect(toDbNumeric(porNome["Lighter"]!.resultado)).toBe("-1.10");
  });

  it("não conta volume operado como capital", () => {
    // Ondo Perp tem $3.450 de volume registrado e só $70 aportados.
    const ondo = projetos.find((p) => p.slug === "ondo-perp");
    expect(toDbNumeric(ondo!.aportado)).toBe("70.00");
  });
});

describe("selectProjectBySlug", () => {
  it("devolve null para slug inexistente", () => {
    expect(selectProjectBySlug(ds, "nao-existe", HOJE)).toBeNull();
  });

  it("marca conta sem snapshot com saldo nulo, não zero", () => {
    const saturn = selectProjectBySlug(ds, "saturn", HOJE)!;
    const mbox = saturn.contasDetalhe.find((c) => c.label === "mbox")!;
    expect(mbox.saldo).toBeNull();
    expect(mbox.resultado).toBeNull();
    expect(toDbNumeric(mbox.aportado)).toBe("100.00");
  });

  it("expõe o saldo real quando existe snapshot", () => {
    const nansen = selectProjectBySlug(ds, "nansen", HOJE)!;
    const brave = nansen.contasDetalhe.find((c) => c.label === "brave")!;
    // Dois snapshots na planilha: 15.00 em 01/07 e 7.33 em 07/07.
    expect(toDbNumeric(brave.saldo!)).toBe("7.33");
    expect(brave.saldoEm).toBe("2026-07-07");
  });

  it("inclui snapshots no histórico marcados como tal", () => {
    const nansen = selectProjectBySlug(ds, "nansen", HOJE)!;
    const snapshots = nansen.historico.filter((h) => h.isSnapshot);
    expect(snapshots).toHaveLength(4);
    expect(nansen.historico[0]?.data).toBe("2026-07-27"); // mais recente primeiro
  });

  it("calcula progresso de meta a partir do volume operado", () => {
    const ondo = selectProjectBySlug(ds, "ondo-perp", HOJE)!;
    const meta = ondo.metas[0]!;
    expect(toDbNumeric(meta.alvo)).toBe("10000.00");
    expect(toDbNumeric(meta.atual)).toBe("3450.00");
  });
});

describe("selectAccounts", () => {
  it("soma uma conta atravessando todos os projetos", () => {
    const contas = selectAccounts(ds);
    const chrome = contas.find((c) => c.label === "chrome")!;
    // Minara 9 + Nansen 9 + Ondo 40 + Lighter 20
    expect(toDbNumeric(chrome.aportado)).toBe("78.00");
    expect(chrome.projetos).toBe(4);
  });
});

describe("selectPendingTasks", () => {
  const tarefas = selectPendingTasks(ds, HOJE);

  it("ordena da mais atrasada para a mais distante", () => {
    expect(tarefas[0]?.vencimento).toBe("2026-07-26");
  });

  it("classifica urgência a partir da data de referência", () => {
    expect(tarefas.filter((t) => t.urgencia === "atrasada")).toHaveLength(3);
    expect(tarefas.filter((t) => t.urgencia === "hoje")).toHaveLength(6);
  });

  it("não inclui ocorrências já concluídas", () => {
    expect(tarefas.every((t) => !t.concluida)).toBe(true);
  });
});

describe("selectCapitalPorProjeto", () => {
  it("ordena por capital e ignora projeto sem aporte", () => {
    const capital = selectCapitalPorProjeto(ds);
    expect(capital[0]?.nome).toBe("Saturn");
    expect(toDbNumeric(capital[0]!.aportado)).toBe("100.00");
    expect(capital).toHaveLength(5);
  });
});

describe("helpers de dataset", () => {
  it("gera slug a partir do nome", () => {
    expect(slugify("Ondo Perp")).toBe("ondo-perp");
    expect(slugify("Éther Fi!")).toBe("ether-fi");
  });

  it("evita colisão de slug", () => {
    expect(uniqueSlug("Nansen", ["nansen"])).toBe("nansen-2");
    expect(uniqueSlug("Nansen", ["nansen", "nansen-2"])).toBe("nansen-3");
  });

  it("gera ids distintos", () => {
    expect(novoId("prj")).not.toBe(novoId("prj"));
    expect(novoId("prj").startsWith("prj-")).toBe(true);
  });
});
