import { describe, expect, it } from "vitest";

import { datasetInicial, HOJE } from "@/db/queries/fixtures";
import { novoId, slugify, uniqueSlug } from "@/lib/dataset";
import { toDbNumeric } from "@/lib/money";
import {
  selectAccounts,
  selectCapitalPorProjeto,
  selectCotacoes,
  selectDashboardSummary,
  selectPendingTasks,
  selectProjectBySlug,
  selectProjects,
  selectTokensSemCotacao,
  selectVolumeDoProjeto,
} from "@/lib/selectors";

const ds = datasetInicial();

describe("selectDashboardSummary", () => {
  const resumo = selectDashboardSummary(ds, HOJE);

  it("soma o capital aportado", () => {
    // 44 Meridian + 23 Solstice + 70 Vertex + 20 Prisma + 180 Nebula
    expect(toDbNumeric(resumo.capitalDepositado)).toBe("337.00");
  });

  it("exposição é a soma dos lançamentos, com token revalorizado", () => {
    // Nebula entra com 1 SOL a $195, não com os $180 aportados.
    expect(toDbNumeric(resumo.exposicao)).toBe("348.18");
    expect(toDbNumeric(resumo.resultado)).toBe("11.18");
    expect(resumo.roi).toBe(3.3);
  });

  it("separa rendimentos do capital aportado", () => {
    // 1,40 + 0,45 + 0,30 + 2,80 + 1,50
    expect(toDbNumeric(resumo.rendimentos)).toBe("6.45");
  });

  it("não reporta token sem cotação quando todos têm preço", () => {
    expect(resumo.tokensSemCotacao).toEqual([]);
  });

  it("conta contas e projetos ativos", () => {
    expect(resumo.projetosAtivos).toBe(5);
    expect(resumo.contasAtivas).toBe(6);
  });
});

describe("selectProjects", () => {
  const projetos = selectProjects(ds, HOJE);

  it("ordena por prioridade", () => {
    expect(projetos[0]?.nome).toBe("Vertex Perp");
    expect(projetos[0]?.prioridade).toBe(5);
  });

  it("calcula o resultado de cada projeto", () => {
    const porNome = Object.fromEntries(projetos.map((p) => [p.nome, p]));
    expect(toDbNumeric(porNome["Vertex Perp"]!.capitalDepositado)).toBe("70.00");
    expect(toDbNumeric(porNome["Vertex Perp"]!.resultado)).toBe("4.40");
    expect(toDbNumeric(porNome["Meridian"]!.resultado)).toBe("-6.67");
    expect(toDbNumeric(porNome["Prisma DEX"]!.resultado)).toBe("-1.10");
  });

  it("token valorizado aparece como resultado positivo", () => {
    const nebula = projetos.find((p) => p.slug === "nebula")!;
    // Aportou $180 em 1 SOL, que hoje vale $195.
    expect(toDbNumeric(nebula.capitalDepositado)).toBe("180.00");
    expect(toDbNumeric(nebula.exposicao)).toBe("195.00");
    expect(toDbNumeric(nebula.resultado)).toBe("15.00");
  });

  it("não conta volume operado como capital", () => {
    const vertex = projetos.find((p) => p.slug === "vertex-perp");
    expect(toDbNumeric(vertex!.capitalDepositado)).toBe("70.00");
  });
});

describe("selectProjectBySlug", () => {
  it("devolve null para slug inexistente", () => {
    expect(selectProjectBySlug(ds, "nao-existe", HOJE)).toBeNull();
  });

  it("saldo da conta é a soma dos lançamentos dela", () => {
    const meridian = selectProjectBySlug(ds, "meridian", HOJE)!;
    const brave = meridian.contasDetalhe.find((c) => c.label === "brave")!;
    // Depósito de 15 menos perda de 7,67.
    expect(toDbNumeric(brave.aportado)).toBe("15.00");
    expect(toDbNumeric(brave.saldo)).toBe("7.33");
    expect(toDbNumeric(brave.resultado)).toBe("-7.67");
  });

  it("expõe a posição em token do projeto", () => {
    const nebula = selectProjectBySlug(ds, "nebula", HOJE)!;
    expect(nebula.posicoesToken).toHaveLength(1);
    const sol = nebula.posicoesToken[0]!;
    expect(sol.symbol).toBe("SOL");
    expect(sol.quantidade).toBe(1);
    expect(toDbNumeric(sol.investidoUsd)).toBe("180.00");
    // 1 SOL por $180: entrou a $180; hoje vale $195.
    expect(toDbNumeric(sol.precoMedioUsd!)).toBe("180.00");
    expect(toDbNumeric(sol.valorAtualUsd)).toBe("195.00");
    expect(toDbNumeric(sol.valorizacao!)).toBe("15.00");
    expect(sol.valorizacaoPercent).toBe(8.3);
  });

  it("projeto sem token não tem posição", () => {
    expect(selectProjectBySlug(ds, "vertex-perp", HOJE)!.posicoesToken).toHaveLength(0);
  });

  it("histórico traz só lançamentos, do mais recente ao mais antigo", () => {
    const meridian = selectProjectBySlug(ds, "meridian", HOJE)!;
    expect(meridian.historico).toHaveLength(6);
    expect(meridian.historico[0]?.data).toBe("2026-07-27");
  });

  it("histórico preserva token e quantidade", () => {
    const nebula = selectProjectBySlug(ds, "nebula", HOJE)!;
    const lancamento = nebula.historico[0]!;
    expect(lancamento.tokenSymbol).toBe("SOL");
    expect(lancamento.tokenAmount).toBe("1");
  });

  it("soma o progresso dos lançamentos feitos na própria meta", () => {
    const vertex = selectProjectBySlug(ds, "vertex-perp", HOJE)!;
    const meta = vertex.metas[0]!;
    expect(toDbNumeric(meta.alvo)).toBe("10000.00");
    // 2500 + 1800, os dois lançamentos daquela meta. Antes este número saía do
    // volume operado do projeto inteiro, e por isso não era de meta nenhuma.
    expect(toDbNumeric(meta.atual)).toBe("4300.00");
  });

  it("lista os lançamentos da meta, do mais novo para o mais antigo", () => {
    const vertex = selectProjectBySlug(ds, "vertex-perp", HOJE)!;
    const datas = vertex.metas[0]!.lancamentos.map((l) => l.data);
    expect(datas).toEqual(["2026-07-24", "2026-07-10"]);
  });
});

describe("selectAccounts", () => {
  it("soma uma conta atravessando todos os projetos", () => {
    const contas = selectAccounts(ds);
    const chrome = contas.find((c) => c.label === "chrome")!;
    // Meridian 9 + Solstice 9 + Vertex 40 + Prisma 20
    expect(toDbNumeric(chrome.capitalDepositado)).toBe("78.00");
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
    expect(capital[0]?.nome).toBe("Nebula");
    expect(toDbNumeric(capital[0]!.capitalDepositado)).toBe("180.00");
    expect(capital).toHaveLength(5);
  });
});

describe("cotações", () => {
  it("lista os tokens em uso com o preço informado", () => {
    const cotacoes = selectCotacoes(ds);
    const sol = cotacoes.find((c) => c.symbol === "SOL")!;
    expect(toDbNumeric(sol.precoUsd)).toBe("195.00");
    expect(sol.usadoEm).toBe(1);
  });

  it("não há token pendente de cotação nos dados iniciais", () => {
    expect(selectTokensSemCotacao(ds)).toEqual([]);
  });

  it("token usado sem preço aparece como pendente", () => {
    const comArb = {
      ...ds,
      transactions: [
        ...ds.transactions,
        {
          id: "tx-teste",
          projectId: "prj-vertex",
          accountId: "acc-brave",
          occurredAt: HOJE,
          type: "deposit" as const,
          amountUsd: "50.00",
          tokenSymbol: "ARB",
          tokenAmount: "40",
          description: null,
        },
      ],
    };
    expect(selectTokensSemCotacao(comArb)).toEqual(["ARB"]);
    expect(selectCotacoes(comArb).find((c) => c.symbol === "ARB")?.atualizadoEm).toBe("");
  });
});

describe("helpers de dataset", () => {
  it("gera slug a partir do nome", () => {
    expect(slugify("Vertex Perp")).toBe("vertex-perp");
    expect(slugify("Éther Fi!")).toBe("ether-fi");
  });

  it("evita colisão de slug", () => {
    expect(uniqueSlug("Meridian", ["meridian"])).toBe("meridian-2");
    expect(uniqueSlug("Meridian", ["meridian", "meridian-2"])).toBe("meridian-3");
  });

  it("gera ids distintos", () => {
    expect(novoId("prj")).not.toBe(novoId("prj"));
    expect(novoId("prj").startsWith("prj-")).toBe(true);
  });
});

describe("selectVolumeDoProjeto", () => {
  const perp = ds.projects.find((p) => p.slug === "vertex-perp")!;
  const volume = selectVolumeDoProjeto(ds, perp.id, HOJE);

  it("soma apenas lançamentos de volume", () => {
    const somaDireta = ds.transactions
      .filter((t) => t.projectId === perp.id && t.type === "volume_traded")
      .reduce((acc, t) => acc + Number(t.amountUsd) * 100, 0);
    expect(volume.total).toBe(Math.round(somaDireta));
  });

  /*
   * A garantia que importa: volume não é dinheiro. Se um depósito vazasse para
   * cá, o número viraria uma mistura sem significado.
   */
  it("não inclui depósitos nem rendimentos", () => {
    const tipos = new Set(
      ds.transactions
        .filter((t) => t.projectId === perp.id)
        .map((t) => t.type),
    );
    expect(tipos.has("deposit")).toBe(true);
    expect(volume.historico.length).toBeLessThan(
      ds.transactions.filter((t) => t.projectId === perp.id).length,
    );
  });

  it("o total por conta soma o total do projeto", () => {
    const soma = volume.contas.reduce((acc, c) => acc + c.total, 0);
    expect(soma).toBe(volume.total);
  });

  it("lista do mais recente para o mais antigo", () => {
    const datas = volume.historico.map((l) => l.data);
    expect([...datas].sort().reverse()).toEqual(datas);
  });

  it("projeto sem volume devolve estrutura vazia, não quebra", () => {
    const semVolume = ds.projects.find((p) => p.slug !== "vertex-perp")!;
    const v = selectVolumeDoProjeto(ds, semVolume.id, HOJE);
    expect(v.total).toBeGreaterThanOrEqual(0);
    expect(Array.isArray(v.contas)).toBe(true);
  });
});

describe("selectVolumeDoProjeto: período coberto", () => {
  const perp = ds.projects.find((p) => p.slug === "vertex-perp")!;
  const volume = selectVolumeDoProjeto(ds, perp.id, HOJE);

  it("desde é o lançamento mais antigo, não o mais recente", () => {
    const datas = ds.transactions
      .filter((t) => t.projectId === perp.id && t.type === "volume_traded")
      .map((t) => t.occurredAt)
      .sort();
    expect(volume.desde).toBe(datas[0]);
  });

  /*
   * Quando todo o volume é recente, os dois números coincidem. A tela usa essa
   * igualdade para não repetir o mesmo valor duas vezes, o que parecia erro.
   */
  it("recente iguala o total quando não há volume antigo", () => {
    const recentes = selectVolumeDoProjeto(ds, perp.id, volume.desde!);
    expect(recentes.recente).toBe(recentes.total);
  });

  it("recente exclui o que ficou fora da janela de 30 dias", () => {
    // Um "hoje" bem no futuro joga todos os lançamentos para fora da janela.
    const futuro = selectVolumeDoProjeto(ds, perp.id, "2027-01-01");
    expect(futuro.total).toBe(volume.total);
    expect(futuro.recente).toBe(0);
  });
});
