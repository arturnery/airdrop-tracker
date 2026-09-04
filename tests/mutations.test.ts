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
      name: "Meridian",
      status: "ativo",
      category: "perps",
      pointsLabel: null,
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
    expect(criado.slug).toBe("meridian-2");
  });

  it("vincula a conta ao projeto ao lançar em par inexistente", () => {
    // acc-mbox nunca farmou o Prisma DEX.
    const ds = M.criarLancamento(base(), {
      projectId: "prj-prisma",
      accountId: "acc-mbox",
      occurredAt: HOJE,
      type: "deposit",
      amount: cents(5000),
      tokenSymbol: null,
      tokenAmount: null,
      description: null,
    });
    const par = ds.projectAccounts.find(
      (p) => p.projectId === "prj-prisma" && p.accountId === "acc-mbox",
    );
    expect(par).toBeDefined();
    expect(par?.startedAt).toBe(HOJE);
  });

  it("não duplica vínculo existente", () => {
    const antes = base().projectAccounts.length;
    const ds = M.vincularConta(base(), {
      projectId: "prj-meridian",
      accountId: "acc-brave",
      status: "ativa",
      startedAt: HOJE,
    });
    expect(ds.projectAccounts).toHaveLength(antes);
  });

  it("guarda token e quantidade quando o aporte foi em cripto", () => {
    const ds = M.criarLancamento(base(), {
      projectId: "prj-nebula",
      accountId: "acc-mbox",
      occurredAt: HOJE,
      type: "deposit",
      amount: cents(18000),
      tokenSymbol: "sol",
      tokenAmount: "1",
      description: null,
    });
    const criado = ds.transactions.at(-1)!;
    // Símbolo normalizado para maiúsculo na gravação.
    expect(criado.tokenSymbol).toBe("SOL");
    expect(criado.tokenAmount).toBe("1");
  });

  it("expande tarefa sem conta para todas as contas do projeto", () => {
    const ds = M.criarTarefa(
      base(),
      {
        projectId: "prj-vertex",
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
    // Vertex Perp tem 4 contas vinculadas.
    expect(ocorrencias).toHaveLength(4);
    expect(ocorrencias.every((o) => o.dueDate === HOJE)).toBe(true);
  });

  it("congela o valor do airdrop no momento do registro", () => {
    const ds = M.registrarRecebimento(base(), {
      projectId: "prj-vertex",
      accountId: "acc-brave",
      receivedAt: HOJE,
      tokenSymbol: "vtx",
      tokenAmount: "1250",
      priceUsd: "0.42",
    });
    const claim = ds.airdropClaims[0]!;
    expect(claim.tokenSymbol).toBe("VTX");
    expect(claim.valueUsd).toBe("525.00");
  });
});

/**
 * Editar um recebimento não é trocar campos: o valor em dólar é derivado, e os
 * dois modos de informar afirmam coisas diferentes. Guardar o total antigo ao
 * lado de uma quantidade nova deixaria no banco uma multiplicação que não
 * fecha, e é exatamente isso que um `map` ingênuo sobre os campos faria.
 */
/**
 * Catálogo da comunidade (ARCHITECTURE §13): publicar copia campos editoriais
 * do projeto para uma entrada independente, e adotar copia de volta para um
 * projeto novo. Nenhuma leitura atravessa essa fronteira depois da cópia, e é
 * essa independência que os testes abaixo verificam: mexer no projeto de
 * origem depois de publicar não muda a entrada, e mexer na entrada depois de
 * adotar não muda o projeto adotado.
 */
describe("catálogo da comunidade", () => {
  it("publica com os campos editoriais do projeto, e sem os pessoais", () => {
    const ds = M.destacarProjeto(base(), {
      projectId: "prj-vertex",
      userId: "usr-1",
      summary: "resumo para a comunidade",
    });
    const entrada = ds.catalogProjects.find((c) => c.sourceProjectId === "prj-vertex")!;

    expect(entrada.name).toBe("Vertex Perp");
    expect(entrada.chain).toBe("Arbitrum");
    expect(entrada.summary).toBe("resumo para a comunidade");
    expect(entrada.createdBy).toBe("usr-1");
    expect(entrada.publishedAt).not.toBeNull();
  });

  it("publicar de novo atualiza a mesma linha, não cria uma segunda", () => {
    const primeira = M.destacarProjeto(base(), {
      projectId: "prj-vertex",
      userId: "usr-1",
      summary: "resumo original",
    });
    const segunda = M.destacarProjeto(primeira, {
      projectId: "prj-vertex",
      userId: "usr-1",
      summary: "resumo corrigido",
    });

    const doProjeto = segunda.catalogProjects.filter(
      (c) => c.sourceProjectId === "prj-vertex",
    );
    expect(doProjeto).toHaveLength(1);
    expect(doProjeto[0]!.summary).toBe("resumo corrigido");
  });

  it("dois projetos de nomes iguais recebem slugs de catálogo diferentes", () => {
    const comHomonimo = M.criarProjeto(base(), {
      name: "Vertex Perp",
      status: "ativo",
      category: "perps",
      pointsLabel: null,
      chain: null,
      priority: 3,
      websiteUrl: null,
      discordUrl: null,
      twitterUrl: null,
      docsUrl: null,
      expectedTgeDate: null,
      notes: null,
    });

    const umPublicado = M.destacarProjeto(comHomonimo.dataset, {
      projectId: "prj-vertex",
      userId: "usr-1",
      summary: null,
    });
    const doisPublicados = M.destacarProjeto(umPublicado, {
      projectId: comHomonimo.id,
      userId: "usr-2",
      summary: null,
    });

    const slugs = doisPublicados.catalogProjects.map((c) => c.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("remover o destaque não apaga a entrada, só a despublica", () => {
    const publicado = M.destacarProjeto(base(), {
      projectId: "prj-vertex",
      userId: "usr-1",
      summary: "resumo",
    });
    const removido = M.removerDestaque(publicado, "prj-vertex");
    const entrada = removido.catalogProjects.find(
      (c) => c.sourceProjectId === "prj-vertex",
    )!;

    expect(entrada).toBeDefined();
    expect(entrada.publishedAt).toBeNull();
  });

  it("adota copiando os campos, com adoptedFromId apontando para a entrada", () => {
    const publicado = M.destacarProjeto(base(), {
      projectId: "prj-vertex",
      userId: "usr-1",
      summary: "resumo",
    });
    const entrada = publicado.catalogProjects[0]!;

    const resultado = M.adotarDoCatalogo(publicado, { catalogId: entrada.id });
    expect(resultado).not.toBeNull();

    const adotado = resultado!.dataset.projects.find((p) => p.id === resultado!.id)!;
    expect(adotado.name).toBe("Vertex Perp");
    expect(adotado.chain).toBe("Arbitrum");
    expect(adotado.adoptedFromId).toBe(entrada.id);
    // Pessoal, e não copiado da entrada: nasce limpo para quem adotou escrever.
    expect(adotado.notes).toBeNull();
  });

  it("não adota uma entrada despublicada", () => {
    const publicado = M.destacarProjeto(base(), {
      projectId: "prj-vertex",
      userId: "usr-1",
      summary: "resumo",
    });
    const entrada = publicado.catalogProjects[0]!;
    const removido = M.removerDestaque(publicado, "prj-vertex");

    expect(M.adotarDoCatalogo(removido, { catalogId: entrada.id })).toBeNull();
  });

  it("editar o projeto de origem depois de publicar não muda a entrada", () => {
    const publicado = M.destacarProjeto(base(), {
      projectId: "prj-vertex",
      userId: "usr-1",
      summary: "resumo",
    });
    const editado = M.atualizarProjeto(publicado, "prj-vertex", {
      name: "Vertex Perp v2",
    });

    const entrada = editado.catalogProjects.find(
      (c) => c.sourceProjectId === "prj-vertex",
    )!;
    // A cópia é do instante da publicação. Sincronizar foi descartado, não
    // adiado (§13.3): quem quer o nome novo no catálogo clica em publicar de novo.
    expect(entrada.name).toBe("Vertex Perp");
  });

  it("editar a entrada adotada não muda o projeto de origem, nem o contrário", () => {
    const publicado = M.destacarProjeto(base(), {
      projectId: "prj-vertex",
      userId: "usr-1",
      summary: "resumo",
    });
    const entrada = publicado.catalogProjects[0]!;
    const { dataset: comAdocao, id: idAdotado } = M.adotarDoCatalogo(publicado, {
      catalogId: entrada.id,
    })!;

    const editado = M.atualizarProjeto(comAdocao, idAdotado, {
      status: "pausado",
      notes: "anotação pessoal de quem adotou",
    });

    const origem = editado.projects.find((p) => p.id === "prj-vertex")!;
    expect(origem.status, "o projeto de origem não sente a edição do adotado").toBe(
      "ativo",
    );
  });
});

describe("correção de recebimento", () => {
  const comRecebimento = () =>
    M.registrarRecebimento(base(), {
      projectId: "prj-vertex",
      accountId: "acc-brave",
      receivedAt: HOJE,
      tokenSymbol: "vtx",
      tokenAmount: "1250",
      priceUsd: "0.42",
    });

  const idDoPrimeiro = (ds: ReturnType<typeof base>) => ds.airdropClaims[0]!.id;

  it("recalcula o valor quando a quantidade muda", () => {
    const ds = comRecebimento();
    const corrigido = M.atualizarRecebimento(ds, idDoPrimeiro(ds), {
      accountId: "acc-brave",
      receivedAt: HOJE,
      tokenSymbol: "VTX",
      modo: "token",
      tokenAmount: "2500",
      priceUsd: "0.42",
    });

    expect(corrigido.airdropClaims[0]!.valueUsd).toBe("1050.00");
  });

  it("apaga quantidade e preço ao passar para o total em dólar", () => {
    const ds = comRecebimento();
    const corrigido = M.atualizarRecebimento(ds, idDoPrimeiro(ds), {
      accountId: "acc-brave",
      receivedAt: HOJE,
      tokenSymbol: "VTX",
      modo: "total",
      valueUsd: "600",
    });
    const claim = corrigido.airdropClaims[0]!;

    expect(claim.valueUsd).toBe("600.00");
    expect(claim.tokenAmount, "quantidade que já não se sustenta").toBeNull();
    expect(claim.priceUsd).toBeNull();
  });

  it("passa a afirmar quantidade e preço ao voltar para o modo token", () => {
    const ds = M.registrarRecebimento(base(), {
      projectId: "prj-vertex",
      accountId: "acc-brave",
      receivedAt: HOJE,
      tokenSymbol: "VTX",
      modo: "total",
      valueUsd: "75",
    });
    const corrigido = M.atualizarRecebimento(ds, idDoPrimeiro(ds), {
      accountId: "acc-brave",
      receivedAt: HOJE,
      tokenSymbol: "VTX",
      modo: "token",
      tokenAmount: "300",
      priceUsd: "0.25",
    });
    const claim = corrigido.airdropClaims[0]!;

    expect(claim.tokenAmount).toBe("300");
    expect(claim.valueUsd, "o total antigo não sobrevive").toBe("75.00");
  });

  it("não encosta nos outros recebimentos", () => {
    const ds = M.registrarRecebimento(comRecebimento(), {
      projectId: "prj-nebula",
      accountId: "acc-brave",
      receivedAt: HOJE,
      tokenSymbol: "NEB",
      tokenAmount: "10",
      priceUsd: "1",
    });
    const outro = ds.airdropClaims[1]!;
    const corrigido = M.atualizarRecebimento(ds, idDoPrimeiro(ds), {
      accountId: "acc-brave",
      receivedAt: HOJE,
      tokenSymbol: "VTX",
      modo: "total",
      valueUsd: "1",
    });

    expect(corrigido.airdropClaims[1]).toEqual(outro);
  });
});

describe("exclusão em cascata", () => {
  it("apagar projeto leva junto tudo que dependia dele", () => {
    const ds = M.excluirProjeto(base(), "prj-vertex");

    expect(ds.projects.find((p) => p.id === "prj-vertex")).toBeUndefined();
    expect(ds.projectAccounts.filter((p) => p.projectId === "prj-vertex")).toHaveLength(0);
    expect(ds.transactions.filter((t) => t.projectId === "prj-vertex")).toHaveLength(0);
    expect(ds.goals.filter((g) => g.projectId === "prj-vertex")).toHaveLength(0);

    // Nenhuma ocorrência órfã: as tarefas do projeto sumiram com elas.
    const idsRestantes = new Set(ds.tasks.map((t) => t.id));
    expect(ds.taskOccurrences.every((o) => idsRestantes.has(o.taskId))).toBe(true);
  });

  it("o total geral cai exatamente o que o projeto tinha", () => {
    const antes = selectDashboardSummary(base(), HOJE);
    const depois = selectDashboardSummary(M.excluirProjeto(base(), "prj-nebula"), HOJE);
    // Nebula tinha $180 aportados e nenhum outro projeto é afetado.
    expect(toDbNumeric(antes.aportado)).toBe("337.00");
    expect(toDbNumeric(depois.aportado)).toBe("157.00");
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
    // tsk-03 é do Prisma DEX e específica de acc-chrome.
    const ds = M.excluirConta(base(), "acc-chrome");
    const tarefa = ds.tasks.find((t) => t.id === "tsk-03")!;
    expect(tarefa.accountId).toBeNull();
  });

  it("desvincular conta remove só os movimentos daquele par", () => {
    const ds = M.desvincularConta(base(), "prj-vertex", "acc-chrome");

    // Somem os do Vertex Perp com chrome...
    expect(
      ds.transactions.filter(
        (t) => t.projectId === "prj-vertex" && t.accountId === "acc-chrome",
      ),
    ).toHaveLength(0);
    // ...mas chrome continua no Prisma DEX: depósito, volume e perda.
    expect(
      ds.transactions.filter(
        (t) => t.projectId === "prj-prisma" && t.accountId === "acc-chrome",
      ),
    ).toHaveLength(3);
  });

  it("apagar tarefa remove suas ocorrências", () => {
    const ds = M.excluirTarefa(base(), "tsk-01");
    expect(ds.taskOccurrences.filter((o) => o.taskId === "tsk-01")).toHaveLength(0);
    expect(ds.tasks.find((t) => t.id === "tsk-01")).toBeUndefined();
  });

  it("apagar um lançamento muda o saldo, porque o saldo é a soma", () => {
    const antes = selectProjectBySlug(base(), "prisma-dex", HOJE)!;
    expect(toDbNumeric(antes.exposicao)).toBe("18.90");

    // tx-24 é a perda de $1,10 do Prisma DEX.
    const depois = selectProjectBySlug(
      M.excluirLancamento(base(), "tx-24"),
      "prisma-dex",
      HOJE,
    )!;
    expect(toDbNumeric(depois.exposicao)).toBe("20.00");
  });
});

describe("edição", () => {
  it("preserva o slug ao renomear o projeto", () => {
    const ds = M.atualizarProjeto(base(), "prj-vertex", { name: "Vertex Perpétuos" });
    const projeto = ds.projects.find((p) => p.id === "prj-vertex")!;
    expect(projeto.name).toBe("Vertex Perpétuos");
    expect(projeto.slug).toBe("vertex-perp");
  });

  it("recalcula os totais depois de corrigir um lançamento", () => {
    // tx-25 é o aporte de 1 SOL do Nebula, registrado a $180.
    const ds = M.atualizarLancamento(base(), "tx-25", {
      occurredAt: "2026-07-28",
      type: "deposit",
      amount: cents(10000),
      tokenSymbol: "SOL",
      tokenAmount: "1",
      description: "Valor corrigido",
    });
    const resumo = selectDashboardSummary(ds, HOJE);
    // 337 − 180 + 100
    expect(toDbNumeric(resumo.aportado)).toBe("257.00");
    // A exposição não muda: continua 1 SOL a $195.
    expect(toDbNumeric(resumo.exposicao)).toBe("348.18");
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
    M.excluirProjeto(original, "prj-vertex");
    M.criarLancamento(original, {
      projectId: "prj-vertex",
      accountId: "acc-brave",
      occurredAt: HOJE,
      type: "deposit",
      amount: cents(100),
      tokenSymbol: null,
      tokenAmount: null,
      description: null,
    });
    expect(JSON.stringify(original)).toBe(copia);
  });
});
