import { describe, expect, it } from "vitest";

import { datasetInicial, HOJE } from "@/db/queries/fixtures";
import { novoId, slugify, uniqueSlug } from "@/lib/dataset";
import { rotuloDoTipo } from "@/lib/finance";
import { cents, toDbNumeric } from "@/lib/money";
import * as M from "@/lib/mutations";
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
    expect(toDbNumeric(resumo.capitalNoPico)).toBe("337.00");
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
    /*
     * Não fixa qual projeto vence: a remapeada de 1-5 para 1-3 empatou Vertex
     * Perp e Nebula no topo (3, "alta"), e quem desempata por capital é
     * `selectProjects`, não este teste. O que importa aqui é que o primeiro
     * da lista tem a maior prioridade que existe no conjunto.
     */
    const maiorPrioridade = Math.max(...projetos.map((p) => p.prioridade));
    expect(projetos[0]?.prioridade).toBe(maiorPrioridade);
  });

  it("calcula o resultado de cada projeto", () => {
    const porNome = Object.fromEntries(projetos.map((p) => [p.nome, p]));
    expect(toDbNumeric(porNome["Vertex Perp"]!.capitalNoPico)).toBe("70.00");
    expect(toDbNumeric(porNome["Vertex Perp"]!.resultado)).toBe("4.40");
    expect(toDbNumeric(porNome["Meridian"]!.resultado)).toBe("-6.67");
    expect(toDbNumeric(porNome["Prisma DEX"]!.resultado)).toBe("-1.10");
  });

  it("token valorizado aparece como resultado positivo", () => {
    const nebula = projetos.find((p) => p.slug === "nebula")!;
    // Aportou $180 em 1 SOL, que hoje vale $195.
    expect(toDbNumeric(nebula.capitalNoPico)).toBe("180.00");
    expect(toDbNumeric(nebula.exposicao)).toBe("195.00");
    expect(toDbNumeric(nebula.resultado)).toBe("15.00");
  });

  it("não conta volume operado como capital", () => {
    const vertex = projetos.find((p) => p.slug === "vertex-perp");
    expect(toDbNumeric(vertex!.capitalNoPico)).toBe("70.00");
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
    expect(toDbNumeric(chrome.capitalNoPico)).toBe("78.00");
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
    expect(toDbNumeric(capital[0]!.capitalNoPico)).toBe("180.00");
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
  const volume = selectVolumeDoProjeto(ds, perp.id);

  it("o total é a última medição de cada conta, não a soma de todas", () => {
    // As fixtures têm duas medições do mesmo par: 1250 e depois 3450. Somar as
    // duas daria 4700, e o volume acumulado é 3450.
    expect(toDbNumeric(volume.total)).toBe("3450.00");
  });

  it("a variação é a diferença para a medição anterior", () => {
    expect(toDbNumeric(volume.variacao!)).toBe("2200.00");
    expect(toDbNumeric(volume.totalAnterior!)).toBe("1250.00");
  });

  it("o total por conta soma o total do projeto", () => {
    const soma = volume.contas.reduce((acc, c) => acc + (c.total ?? 0), 0);
    expect(soma).toBe(volume.total);
  });

  it("conta sem medição aparece com total nulo, e não zera o projeto", () => {
    const semMedicao = volume.contas.filter((c) => c.total === null);
    expect(semMedicao.length).toBeGreaterThan(0);
    expect(volume.total).toBeGreaterThan(0);
  });

  it("o histórico vai do mais recente para o mais antigo", () => {
    const datas = volume.historico.map((m) => m.data);
    expect([...datas].sort().reverse()).toEqual(datas);
  });

  it("a primeira medição de uma conta não tem variação", () => {
    const primeira = volume.historico.at(-1)!;
    expect(primeira.variacao).toBeNull();
  });

  it("projeto sem medição nenhuma devolve estrutura vazia, não quebra", () => {
    const semVolume = ds.projects.find((p) => p.slug === "nebula")!;
    const v = selectVolumeDoProjeto(ds, semVolume.id);
    expect(v.total).toBe(0);
    expect(v.variacao).toBeNull();
    expect(v.atualizadoEm).toBeNull();
    expect(Array.isArray(v.contas)).toBe(true);
  });

  /*
   * A garantia que sobreviveu à mudança de modelo: volume não é dinheiro.
   * Antes ela protegia contra um depósito vazar para a soma; agora a separação
   * é estrutural, porque medição de volume vive em tabela própria.
   */
  it("nenhum lançamento de dinheiro entra no volume", () => {
    expect(ds.transactions.some((t) => t.projectId === perp.id)).toBe(true);
    expect(volume.historico.every((m) => m.total >= 0)).toBe(true);
    expect(volume.historico.length).toBe(
      ds.volumeSnapshots.filter((v) => v.projectId === perp.id).length,
    );
  });
});


/**
 * "Onde está o capital" é pergunta sobre o presente.
 *
 * A lista exibia depósitos menos retiradas, então um projeto onde entraram $202
 * e restam $20 aparecia com $202: dez vezes mais dinheiro parado do que havia.
 */
describe("selectCapitalPorProjeto", () => {
  const projeto = (ds: ReturnType<typeof datasetInicial>, slug: string) =>
    selectCapitalPorProjeto(ds).find((p) => p.slug === slug);

  it("ordena pelo que está no projeto, não pelo que foi depositado", () => {
    const lista = selectCapitalPorProjeto(datasetInicial());
    const exposicoes = lista.map((p) => p.exposicao);
    expect([...exposicoes].sort((a, b) => b - a)).toEqual(exposicoes);
  });

  it("deixa de fora projeto encerrado, com tudo sacado", () => {
    let ds = datasetInicial();
    const alvo = ds.projects.find((p) => p.slug === "meridian")!;
    const par = ds.projectAccounts.find((p) => p.projectId === alvo.id)!;

    // Saca tudo o que houver, zerando a exposição.
    const saldo = selectCapitalPorProjeto(ds).find((p) => p.slug === "meridian")!.exposicao;
    ds = M.criarLancamento(ds, {
      projectId: alvo.id,
      accountId: par.accountId,
      occurredAt: HOJE,
      type: "withdrawal",
      amount: cents(-saldo),
      tokenSymbol: null,
      tokenAmount: null,
      description: null,
    });

    expect(projeto(ds, "meridian")).toBeUndefined();
  });

  it("deixa de fora exposição negativa, que é lançamento faltando", () => {
    let ds = datasetInicial();
    const alvo = ds.projects.find((p) => p.slug === "nebula")!;
    const par = ds.projectAccounts.find((p) => p.projectId === alvo.id)!;

    ds = M.criarLancamento(ds, {
      projectId: alvo.id,
      accountId: par.accountId,
      occurredAt: HOJE,
      type: "trade_pnl",
      amount: cents(-99999900),
      tokenSymbol: null,
      tokenAmount: null,
      description: null,
    });

    expect(projeto(ds, "nebula")).toBeUndefined();
  });
});

/**
 * O que a mudança de modelo do volume tinha de preservar.
 *
 * Volume passou de incremento para medição de acumulado. O total do projeto
 * mudou de origem, e não pode mudar de significado: continua sendo quanto se
 * operou, continua fora do saldo e do resultado.
 */
describe("volume como medição, e não como lançamento", () => {
  const perp = ds.projects.find((p) => p.slug === "vertex-perp")!;

  it("o volume do projeto vem das medições, não dos lançamentos", () => {
    const resumo = selectProjects(ds, HOJE).find((p) => p.slug === "vertex-perp")!;
    const daAba = selectVolumeDoProjeto(ds, perp.id);
    expect(resumo.volumeOperado).toBe(daAba.total);
  });

  it("volume continua fora do saldo e do resultado", () => {
    const antes = selectProjectBySlug(ds, "vertex-perp", HOJE)!;

    // Uma medição gigante não pode mexer em exposição nem em resultado.
    const comVolume = {
      ...ds,
      volumeSnapshots: [
        ...ds.volumeSnapshots,
        {
          id: "vol-teste",
          projectId: perp.id,
          accountId: ds.projectAccounts.find((p) => p.projectId === perp.id)!.accountId,
          takenAt: "2026-07-28",
          volumeUsd: "999999.00",
          note: null,
        },
      ],
    };
    const depois = selectProjectBySlug(comVolume, "vertex-perp", HOJE)!;

    expect(depois.exposicao).toBe(antes.exposicao);
    expect(depois.resultado).toBe(antes.resultado);
    expect(depois.volumeOperado).toBeGreaterThan(antes.volumeOperado);
  });

  it("o rótulo do tipo antigo continua existindo, para nomear registro velho", () => {
    /*
     * Que `volume_traded` saiu do formulário quem garante é o compilador: o
     * tipo de `TIPOS_LANCAMENTO` não contém mais esse valor, e uma comparação
     * com ele nem passa no typecheck. O que precisa de teste é o outro lado:
     * o rótulo sobreviveu para nomear um lançamento antigo que apareça.
     */
    expect(rotuloDoTipo("volume_traded")).toBe("Volume operado");
    expect(rotuloDoTipo("deposit")).toBe("Depósito");
  });
});
