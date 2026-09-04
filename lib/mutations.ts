import { novoId, uniqueSlug, type Dataset } from "./dataset";
import { toDbNumeric, type Cents } from "./money";
import { valorDoRecebimento } from "./validators";
import { toDbPoints, type Points } from "./points";

/**
 * Mutações do domínio. Toda função é pura: `(Dataset, dados) -> Dataset`.
 *
 * Ficam fora do React pelo mesmo motivo dos selectors: são regra de negócio,
 * precisam de teste, e as Server Actions da fase de backend vão executar
 * exatamente estas transformações contra o Postgres.
 *
 * As exclusões replicam o que as chaves estrangeiras fariam no banco. Apagar
 * um projeto sem apagar suas transações deixaria lançamentos órfãos somando
 * no total geral sem aparecer em tela nenhuma.
 */

type Projeto = Dataset["projects"][number];
type Conta = Dataset["accounts"][number];
type Tarefa = Dataset["tasks"][number];

// ------------------------------------------------------------------ criação

export function criarProjeto(
  ds: Dataset,
  dados: Omit<Projeto, "id" | "slug" | "adoptedFromId">,
): { dataset: Dataset; id: string } {
  const id = novoId("prj");
  const slug = uniqueSlug(
    dados.name,
    ds.projects.map((p) => p.slug),
  );
  return {
    dataset: {
      ...ds,
      // Nasce sem origem: criação manual, por definição, não veio do
      // catálogo. `adotarDoCatalogo`, mais abaixo, é o único outro lugar que
      // grava este campo.
      projects: [...ds.projects, { ...dados, id, slug, adoptedFromId: null }],
    },
    id,
  };
}

export function criarConta(
  ds: Dataset,
  dados: Omit<Conta, "id" | "isActive">,
): { dataset: Dataset; id: string } {
  const id = novoId("acc");
  return {
    dataset: {
      ...ds,
      accounts: [...ds.accounts, { ...dados, id, isActive: true }],
    },
    id,
  };
}

export function vincularConta(
  ds: Dataset,
  dados: Dataset["projectAccounts"][number],
): Dataset {
  const jaExiste = ds.projectAccounts.some(
    (p) => p.projectId === dados.projectId && p.accountId === dados.accountId,
  );
  if (jaExiste) return ds;
  return { ...ds, projectAccounts: [...ds.projectAccounts, dados] };
}

/**
 * Garante o par projeto×conta antes de gravar um movimento: mesma integridade
 * que a FK composta impõe no banco (ARCHITECTURE.md §4.3-B).
 */
function garantirVinculo(
  ds: Dataset,
  projectId: string,
  accountId: string,
  desde: string,
): Dataset["projectAccounts"] {
  const existe = ds.projectAccounts.some(
    (p) => p.projectId === projectId && p.accountId === accountId,
  );
  if (existe) return ds.projectAccounts;
  return [
    ...ds.projectAccounts,
    { projectId, accountId, status: "ativa" as const, startedAt: desde },
  ];
}

export function criarLancamento(
  ds: Dataset,
  dados: {
    projectId: string;
    accountId: string;
    occurredAt: string;
    type: Dataset["transactions"][number]["type"];
    amount: Cents;
    tokenSymbol: string | null;
    tokenAmount: string | null;
    description: string | null;
  },
): Dataset {
  return {
    ...ds,
    projectAccounts: garantirVinculo(
      ds,
      dados.projectId,
      dados.accountId,
      dados.occurredAt,
    ),
    transactions: [
      ...ds.transactions,
      {
        id: novoId("tx"),
        projectId: dados.projectId,
        accountId: dados.accountId,
        occurredAt: dados.occurredAt,
        type: dados.type,
        amountUsd: toDbNumeric(dados.amount),
        tokenSymbol: dados.tokenSymbol?.toUpperCase() ?? null,
        tokenAmount: dados.tokenAmount,
        description: dados.description,
      },
    ],
  };
}


export function criarTarefa(
  ds: Dataset,
  dados: Omit<Tarefa, "id" | "isActive">,
  hoje: string,
): Dataset {
  const taskId = novoId("tsk");
  // Conta nula = a tarefa vale para todas as contas do projeto.
  const contasAlvo = dados.accountId
    ? [dados.accountId]
    : ds.projectAccounts
        .filter((p) => p.projectId === dados.projectId)
        .map((p) => p.accountId);

  const vencimento = dados.dueDate ?? hoje;

  return {
    ...ds,
    tasks: [...ds.tasks, { ...dados, id: taskId, isActive: true }],
    taskOccurrences: [
      ...ds.taskOccurrences,
      ...contasAlvo.map((accountId) => ({
        id: novoId("occ"),
        taskId,
        accountId,
        dueDate: vencimento,
        completedAt: null,
        skipped: false,
      })),
    ],
  };
}

export function criarMeta(
  ds: Dataset,
  dados: {
    projectId: string;
    accountId: string | null;
    title: string;
    metric: Dataset["goals"][number]["metric"];
    target: Cents;
    deadline: string | null;
  },
): Dataset {
  return {
    ...ds,
    goals: [
      ...ds.goals,
      {
        id: novoId("gol"),
        projectId: dados.projectId,
        accountId: dados.accountId,
        title: dados.title,
        metric: dados.metric,
        targetValue: toDbNumeric(dados.target),
        deadline: dados.deadline,
        achievedAt: null,
      },
    ],
  };
}

export function registrarRecebimento(
  ds: Dataset,
  dados: {
    projectId: string;
    accountId: string;
    receivedAt: string;
    tokenSymbol: string;
    modo?: "token" | "total";
    tokenAmount?: string;
    priceUsd?: string;
    valueUsd?: string;
  },
): Dataset {
  const porToken = (dados.modo ?? "token") === "token";
  return {
    ...ds,
    airdropClaims: [
      ...ds.airdropClaims,
      {
        id: novoId("clm"),
        projectId: dados.projectId,
        accountId: dados.accountId,
        receivedAt: dados.receivedAt,
        tokenSymbol: dados.tokenSymbol.toUpperCase(),
        tokenAmount: porToken ? (dados.tokenAmount ?? null) : null,
        priceUsd: porToken ? (dados.priceUsd ?? null) : null,
        // Congelado no registro: o preço muda depois, o histórico não.
        valueUsd: valorDoRecebimento(dados),
      },
    ],
  };
}

export function alternarOcorrencia(ds: Dataset, occurrenceId: string): Dataset {
  return {
    ...ds,
    taskOccurrences: ds.taskOccurrences.map((o) =>
      o.id === occurrenceId
        ? { ...o, completedAt: o.completedAt ? null : new Date().toISOString() }
        : o,
    ),
  };
}

// ------------------------------------------------------------------- edição

export function atualizarProjeto(
  ds: Dataset,
  id: string,
  dados: Partial<Omit<Projeto, "id" | "slug">>,
): Dataset {
  // O slug não muda: está na URL e em links já compartilhados.
  return {
    ...ds,
    projects: ds.projects.map((p) => (p.id === id ? { ...p, ...dados } : p)),
  };
}

export function atualizarConta(
  ds: Dataset,
  id: string,
  dados: Partial<Omit<Conta, "id">>,
): Dataset {
  return {
    ...ds,
    accounts: ds.accounts.map((a) => (a.id === id ? { ...a, ...dados } : a)),
  };
}

export function atualizarTarefa(
  ds: Dataset,
  id: string,
  dados: Partial<Omit<Tarefa, "id">>,
): Dataset {
  return {
    ...ds,
    tasks: ds.tasks.map((t) => (t.id === id ? { ...t, ...dados } : t)),
  };
}

export function atualizarLancamento(
  ds: Dataset,
  id: string,
  dados: {
    occurredAt: string;
    type: Dataset["transactions"][number]["type"];
    amount: Cents;
    tokenSymbol: string | null;
    tokenAmount: string | null;
    description: string | null;
  },
): Dataset {
  return {
    ...ds,
    transactions: ds.transactions.map((t) =>
      t.id === id
        ? {
            ...t,
            occurredAt: dados.occurredAt,
            type: dados.type,
            amountUsd: toDbNumeric(dados.amount),
            tokenSymbol: dados.tokenSymbol?.toUpperCase() ?? null,
            tokenAmount: dados.tokenAmount,
            description: dados.description,
          }
        : t,
    ),
  };
}


export function atualizarVinculo(
  ds: Dataset,
  projectId: string,
  accountId: string,
  dados: { status: "ativa" | "pausada" | "queimada"; startedAt: string },
): Dataset {
  return {
    ...ds,
    projectAccounts: ds.projectAccounts.map((p) =>
      p.projectId === projectId && p.accountId === accountId ? { ...p, ...dados } : p,
    ),
  };
}

// ----------------------------------------------------------------- exclusão

export function excluirProjeto(ds: Dataset, id: string): Dataset {
  const idsTarefas = new Set(
    ds.tasks.filter((t) => t.projectId === id).map((t) => t.id),
  );
  // As metas caem por serem do projeto, e o progresso delas cai junto: uma
  // cascata de dois níveis, como no banco.
  const idsMetas = new Set(
    ds.goals.filter((g) => g.projectId === id).map((g) => g.id),
  );
  return {
    ...ds,
    projects: ds.projects.filter((p) => p.id !== id),
    projectAccounts: ds.projectAccounts.filter((p) => p.projectId !== id),
    transactions: ds.transactions.filter((t) => t.projectId !== id),
    tasks: ds.tasks.filter((t) => t.projectId !== id),
    taskOccurrences: ds.taskOccurrences.filter((o) => !idsTarefas.has(o.taskId)),
    goals: ds.goals.filter((g) => g.projectId !== id),
    goalEntries: ds.goalEntries.filter((e) => !idsMetas.has(e.goalId)),
    airdropClaims: ds.airdropClaims.filter((c) => c.projectId !== id),
  };
}

export function excluirConta(ds: Dataset, id: string): Dataset {
  return {
    ...ds,
    accounts: ds.accounts.filter((a) => a.id !== id),
    projectAccounts: ds.projectAccounts.filter((p) => p.accountId !== id),
    transactions: ds.transactions.filter((t) => t.accountId !== id),
    taskOccurrences: ds.taskOccurrences.filter((o) => o.accountId !== id),
    // A tarefa era específica desta conta: passa a valer para todas, em vez de
    // sumir junto e levar embora a intenção de farming.
    tasks: ds.tasks.map((t) => (t.accountId === id ? { ...t, accountId: null } : t)),
    goals: ds.goals.map((g) => (g.accountId === id ? { ...g, accountId: null } : g)),
    airdropClaims: ds.airdropClaims.filter((c) => c.accountId !== id),
  };
}

export function excluirLancamento(ds: Dataset, id: string): Dataset {
  return { ...ds, transactions: ds.transactions.filter((t) => t.id !== id) };
}


export function excluirTarefa(ds: Dataset, taskId: string): Dataset {
  return {
    ...ds,
    tasks: ds.tasks.filter((t) => t.id !== taskId),
    taskOccurrences: ds.taskOccurrences.filter((o) => o.taskId !== taskId),
  };
}

export function lancarProgressoMeta(
  ds: Dataset,
  dados: {
    goalId: string;
    occurredAt: string;
    value: Cents;
    note: string | null;
  },
): Dataset {
  return {
    ...ds,
    goalEntries: [
      ...ds.goalEntries,
      {
        id: novoId("gle"),
        goalId: dados.goalId,
        occurredAt: dados.occurredAt,
        value: toDbNumeric(dados.value),
        note: dados.note,
      },
    ],
  };
}

export function excluirOcorrencia(ds: Dataset, id: string): Dataset {
  return { ...ds, taskOccurrences: ds.taskOccurrences.filter((o) => o.id !== id) };
}

export function excluirMeta(ds: Dataset, id: string): Dataset {
  return {
    ...ds,
    goals: ds.goals.filter((g) => g.id !== id),
    // Espelha o ON DELETE CASCADE: progresso de meta apagada não deve
    // sobreviver somando em lugar nenhum.
    goalEntries: ds.goalEntries.filter((e) => e.goalId !== id),
  };
}

export function excluirProgressoMeta(ds: Dataset, id: string): Dataset {
  return { ...ds, goalEntries: ds.goalEntries.filter((e) => e.id !== id) };
}

/**
 * Correção de um recebimento já registrado.
 *
 * O valor em dólar é **recalculado**, e não preservado: ele é derivado de
 * quantidade × preço, e manter o valor antigo depois de corrigir a quantidade
 * guardaria uma multiplicação que não fecha. É a mesma `valorDoRecebimento` do
 * registro, para os dois caminhos não divergirem.
 *
 * Trocar de modo limpa o que o outro modo não afirma. Quem lançou o total em
 * dólar e depois informou quantidade e preço não pode ficar com o total antigo
 * ao lado dos números novos, e quem faz o caminho inverso não pode deixar para
 * trás uma quantidade que já não se sustenta.
 */
export function atualizarRecebimento(
  ds: Dataset,
  id: string,
  dados: {
    accountId: string;
    receivedAt: string;
    tokenSymbol: string;
    modo?: "token" | "total";
    tokenAmount?: string;
    priceUsd?: string;
    valueUsd?: string;
  },
): Dataset {
  const porToken = (dados.modo ?? "token") === "token";
  return {
    ...ds,
    airdropClaims: ds.airdropClaims.map((c) =>
      c.id === id
        ? {
            ...c,
            accountId: dados.accountId,
            receivedAt: dados.receivedAt,
            tokenSymbol: dados.tokenSymbol.toUpperCase(),
            tokenAmount: porToken ? (dados.tokenAmount ?? null) : null,
            priceUsd: porToken ? (dados.priceUsd ?? null) : null,
            valueUsd: valorDoRecebimento(dados),
          }
        : c,
    ),
  };
}

export function excluirRecebimento(ds: Dataset, id: string): Dataset {
  return { ...ds, airdropClaims: ds.airdropClaims.filter((c) => c.id !== id) };
}

export function desvincularConta(
  ds: Dataset,
  projectId: string,
  accountId: string,
): Dataset {
  const doPar = (r: { projectId: string; accountId: string }) =>
    r.projectId === projectId && r.accountId === accountId;
  return {
    ...ds,
    projectAccounts: ds.projectAccounts.filter((p) => !doPar(p)),
    transactions: ds.transactions.filter((t) => !doPar(t)),
  };
}

// ------------------------------------------------------------- catálogo

/**
 * Publica ou atualiza a entrada de um projeto no catálogo da comunidade
 * (ARCHITECTURE §13). Um projeto só tem uma entrada: se já existe (achada por
 * `sourceProjectId`), os campos editoriais são recopiados por cima; se não,
 * nasce uma nova.
 *
 * Reaparecer depois de despublicado usa a mesma linha, e não cria outra: é o
 * que faz o `unique(sourceProjectId)` do banco valer, e o que preserva o id
 * de quem já tiver adotado antes de a pessoa remover e publicar de novo.
 *
 * O slug do catálogo é **independente** do slug do projeto de origem: dois
 * admins com um projeto de mesmo nome não podem colidir num campo que é único
 * para o catálogo inteiro, e não por usuário como o slug de `projects`.
 */
export function destacarProjeto(
  ds: Dataset,
  dados: { projectId: string; userId: string; summary: string | null },
): Dataset {
  const projeto = ds.projects.find((p) => p.id === dados.projectId);
  if (!projeto) return ds;

  const existente = ds.catalogProjects.find(
    (c) => c.sourceProjectId === dados.projectId,
  );

  const campos = {
    name: projeto.name,
    category: projeto.category,
    pointsLabel: projeto.pointsLabel,
    chain: projeto.chain,
    websiteUrl: projeto.websiteUrl,
    discordUrl: projeto.discordUrl,
    twitterUrl: projeto.twitterUrl,
    docsUrl: projeto.docsUrl,
    expectedTgeDate: projeto.expectedTgeDate,
    summary: dados.summary,
  };

  if (existente) {
    return {
      ...ds,
      catalogProjects: ds.catalogProjects.map((c) =>
        c.id === existente.id
          ? { ...c, ...campos, publishedAt: new Date().toISOString() }
          : c,
      ),
    };
  }

  const slug = uniqueSlug(
    projeto.name,
    ds.catalogProjects.map((c) => c.slug),
  );

  return {
    ...ds,
    catalogProjects: [
      ...ds.catalogProjects,
      {
        id: novoId("cat"),
        slug,
        ...campos,
        createdBy: dados.userId,
        sourceProjectId: dados.projectId,
        publishedAt: new Date().toISOString(),
      },
    ],
  };
}

/**
 * Tira um projeto do catálogo, sem apagar a entrada.
 *
 * `publishedAt: null` é o único estado de "fora do catálogo" que existe (ver
 * a nota em `db/schema.ts`). Manter a linha, e não apagá-la, é o que faz uma
 * republicação futura reaproveitar o mesmo id, em vez de criar uma segunda
 * entrada para o mesmo projeto.
 */
export function removerDestaque(ds: Dataset, projectId: string): Dataset {
  return {
    ...ds,
    catalogProjects: ds.catalogProjects.map((c) =>
      c.sourceProjectId === projectId ? { ...c, publishedAt: null } : c,
    ),
  };
}

/**
 * Adota uma entrada do catálogo: copia os campos editoriais para um projeto
 * novo, inteiramente da pessoa que adotou.
 *
 * **Cópia, não vínculo** (ARCHITECTURE §13.3): a partir daqui o projeto é
 * indistinguível de um criado à mão. Editar, pausar ou apagar não alcança o
 * catálogo, e o catálogo mudar depois não alcança quem já adotou.
 *
 * `adoptedFromId` fica gravado só para duas coisas: não oferecer a mesma
 * entrada de novo a quem já adotou, e o `unique(userId, adoptedFromId)` do
 * banco impedir adotar duas vezes por engano.
 *
 * Devolve `null` quando a entrada não existe mais ou foi despublicada: pode
 * acontecer se a pessoa demorou para clicar numa tela que ficou aberta.
 */
export function adotarDoCatalogo(
  ds: Dataset,
  dados: { catalogId: string },
): { dataset: Dataset; id: string } | null {
  const entrada = ds.catalogProjects.find(
    (c) => c.id === dados.catalogId && c.publishedAt !== null,
  );
  if (!entrada) return null;

  const id = novoId("prj");
  const slug = uniqueSlug(
    entrada.name,
    ds.projects.map((p) => p.slug),
  );

  const projeto: Dataset["projects"][number] = {
    id,
    slug,
    name: entrada.name,
    status: "ativo",
    category: entrada.category,
    pointsLabel: entrada.pointsLabel,
    chain: entrada.chain,
    priority: 3,
    websiteUrl: entrada.websiteUrl,
    discordUrl: entrada.discordUrl,
    twitterUrl: entrada.twitterUrl,
    docsUrl: entrada.docsUrl,
    expectedTgeDate: entrada.expectedTgeDate,
    notes: null,
    adoptedFromId: entrada.id,
  };

  return {
    dataset: { ...ds, projects: [...ds.projects, projeto] },
    id,
  };
}

// ------------------------------------------------------------------- pontos

export function registrarPontos(
  ds: Dataset,
  dados: {
    projectId: string;
    accountId: string;
    takenAt: string;
    points: Points;
    note: string | null;
  },
): Dataset {
  return {
    ...ds,
    projectAccounts: garantirVinculo(
      ds,
      dados.projectId,
      dados.accountId,
      dados.takenAt,
    ),
    // Uma medição por par por dia, como nos saldos: registrar de novo no mesmo
    // dia corrige o valor em vez de criar uma variação fantasma de zero.
    pointsSnapshots: [
      ...ds.pointsSnapshots.filter(
        (p) =>
          !(
            p.projectId === dados.projectId &&
            p.accountId === dados.accountId &&
            p.takenAt === dados.takenAt
          ),
      ),
      {
        id: novoId("pts"),
        projectId: dados.projectId,
        accountId: dados.accountId,
        takenAt: dados.takenAt,
        points: toDbPoints(dados.points),
        note: dados.note,
      },
    ],
  };
}

export function atualizarPontos(
  ds: Dataset,
  id: string,
  dados: { takenAt: string; points: Points; note: string | null },
): Dataset {
  return {
    ...ds,
    pointsSnapshots: ds.pointsSnapshots.map((p) =>
      p.id === id
        ? {
            ...p,
            takenAt: dados.takenAt,
            points: toDbPoints(dados.points),
            note: dados.note,
          }
        : p,
    ),
  };
}

export function excluirPontos(ds: Dataset, id: string): Dataset {
  return { ...ds, pointsSnapshots: ds.pointsSnapshots.filter((p) => p.id !== id) };
}

// ----------------------------------------------------------------- cotações

/**
 * Define ou atualiza a cotação de um token.
 *
 * Sem API externa por decisão de projeto: o preço é informado pelo usuário e
 * vale até ele atualizar. Um símbolo por registro: reinformar substitui.
 */
export function definirCotacao(
  ds: Dataset,
  dados: { symbol: string; priceUsd: Cents; updatedAt: string },
): Dataset {
  const simbolo = dados.symbol.trim().toUpperCase();
  return {
    ...ds,
    tokenPrices: [
      ...ds.tokenPrices.filter((p) => p.symbol.toUpperCase() !== simbolo),
      {
        symbol: simbolo,
        priceUsd: toDbNumeric(dados.priceUsd),
        updatedAt: dados.updatedAt,
      },
    ],
  };
}

export function excluirCotacao(ds: Dataset, symbol: string): Dataset {
  const simbolo = symbol.toUpperCase();
  return {
    ...ds,
    tokenPrices: ds.tokenPrices.filter((p) => p.symbol.toUpperCase() !== simbolo),
  };
}
