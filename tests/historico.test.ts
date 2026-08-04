import { describe, expect, it } from "vitest";

import { datasetInicial } from "@/db/queries/fixtures";
import * as M from "@/lib/mutations";
import { cents, toDbNumeric } from "@/lib/money";
import {
  agruparAtividadePorDia,
  selectAtividade,
  selectProjects,
} from "@/lib/selectors";

const base = () => datasetInicial();
const HOJE = "2026-07-30";

describe("selectAtividade", () => {
  const feed = selectAtividade(base());

  it("junta lançamentos, saldos e tarefas concluídas num só feed", () => {
    const ds = base();
    const esperado =
      ds.transactions.length +
      ds.airdropClaims.length +
      ds.taskOccurrences.filter((o) => o.completedAt).length;
    expect(feed).toHaveLength(esperado);
  });

  it("ordena do mais recente para o mais antigo", () => {
    const datas = feed.map((f) => f.data);
    const ordenado = [...datas].sort((a, b) => b.localeCompare(a));
    expect(datas).toEqual(ordenado);
  });

  it("classifica cada tipo de evento", () => {
    const tipos = new Set(feed.map((f) => f.tipo));
    expect(tipos.has("deposito")).toBe(true);
    expect(tipos.has("rendimento")).toBe(true);
    expect(tipos.has("volume")).toBe(true);
    expect(tipos.has("tarefa")).toBe(true);
  });

  it("converte o instante de conclusão da tarefa em dia", () => {
    const tarefa = feed.find((f) => f.tipo === "tarefa")!;
    // completedAt é ISO completo; o feed trabalha em "YYYY-MM-DD".
    expect(tarefa.data).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(tarefa.valor).toBeNull();
  });

  it("respeita o limite quando informado", () => {
    expect(selectAtividade(base(), 5)).toHaveLength(5);
  });

  it("não inclui tarefa ainda pendente", () => {
    const concluidas = feed.filter((f) => f.tipo === "tarefa");
    const ds = base();
    expect(concluidas).toHaveLength(
      ds.taskOccurrences.filter((o) => o.completedAt).length,
    );
  });

  it("registra o que foi criado agora", () => {
    const ds = M.criarLancamento(base(), {
      projectId: "prj-nebula",
      accountId: "acc-mbox",
      occurredAt: HOJE,
      type: "deposit",
      amount: cents(2500),
      tokenSymbol: null,
      tokenAmount: null,
      description: "Aporte de teste",
    });
    const feedNovo = selectAtividade(ds);
    expect(feedNovo[0]?.titulo).toBe("Depósito");
    expect(feedNovo[0]?.detalhe).toBe("Aporte de teste");
    expect(toDbNumeric(feedNovo[0]!.valor!)).toBe("25.00");
  });

  it("some do feed quando o registro é excluído", () => {
    const antes = selectAtividade(base()).length;
    const depois = selectAtividade(M.excluirLancamento(base(), "tx-01")).length;
    expect(depois).toBe(antes - 1);
  });

  it("ignora movimento de projeto que não existe mais", () => {
    // excluirProjeto remove tudo em cascata; nada deve sobrar no feed.
    const ds = M.excluirProjeto(base(), "prj-vertex");
    const feedFiltrado = selectAtividade(ds);
    expect(feedFiltrado.every((f) => f.projetoSlug !== "vertex-perp")).toBe(true);
  });
});

describe("agruparAtividadePorDia", () => {
  it("agrupa mantendo a ordem cronológica dos dias", () => {
    const dias = agruparAtividadePorDia(selectAtividade(base()));
    const datas = dias.map((d) => d.data);
    expect(datas).toEqual([...datas].sort((a, b) => b.localeCompare(a)));
    expect(new Set(datas).size).toBe(datas.length);
  });

  it("preserva todos os itens", () => {
    const feed = selectAtividade(base());
    const dias = agruparAtividadePorDia(feed);
    const total = dias.reduce((acc, d) => acc + d.itens.length, 0);
    expect(total).toBe(feed.length);
  });
});

describe("categoria de projeto", () => {
  it("expõe a categoria em cada projeto", () => {
    const projetos = selectProjects(base(), HOJE);
    const porNome = Object.fromEntries(projetos.map((p) => [p.nome, p.categoria]));
    expect(porNome["Vertex Perp"]).toBe("perps");
    expect(porNome["Prisma DEX"]).toBe("perps");
    expect(porNome["Meridian"]).toBe("interacoes");
    expect(porNome["Nebula"]).toBe("liquidez");
  });

  it("permite filtrar por categoria", () => {
    const projetos = selectProjects(base(), HOJE);
    expect(projetos.filter((p) => p.categoria === "perps")).toHaveLength(2);
  });

  it("mantém a categoria ao editar outro campo", () => {
    const ds = M.atualizarProjeto(base(), "prj-vertex", { priority: 1 });
    const projeto = ds.projects.find((p) => p.id === "prj-vertex")!;
    expect(projeto.category).toBe("perps");
    expect(projeto.priority).toBe(1);
  });
});
