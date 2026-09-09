/**
 * Dados de desenvolvimento: substituídos pelo Neon na fase de backend.
 *
 * Formato deliberadamente igual ao que o Drizzle devolve: valores `numeric`
 * como STRING, datas como "YYYY-MM-DD". A agregação em `db/queries` já opera
 * sobre o formato real, então a troca por SQL não muda a lógica.
 *
 * PROCEDÊNCIA DOS DADOS
 *  - Transações e os dois snapshots de Meridian/navegador-1: reais, vindos da planilha.
 *  - Demais snapshots, tarefas e metas: exemplos para dar o que ver às telas.
 *  - `chain` dos projetos: exemplo: conferir antes de levar a sério.
 */

export const HOJE = "2026-07-28";

export type RawAccount = {
  id: string;
  label: string;
  walletAddress: string | null;
  email: string | null;
  isActive: boolean;
};

export const rawAccounts: RawAccount[] = [
  {
    id: "acc-email",
    label: "conta principal",
    walletAddress: null,
    email: "principal@exemplo.com",
    isActive: true,
  },
  { id: "acc-brave", label: "brave", walletAddress: null, email: null, isActive: true },
  { id: "acc-chrome", label: "chrome", walletAddress: null, email: null, isActive: true },
  {
    id: "acc-chrome-1",
    label: "chrome (Perfil 1)",
    walletAddress: null,
    email: null,
    isActive: true,
  },
  {
    id: "acc-chrome-2",
    label: "chrome (Perfil 2)",
    walletAddress: null,
    email: null,
    isActive: true,
  },
  { id: "acc-mbox", label: "mbox", walletAddress: null, email: null, isActive: true },
];

export type RawProject = {
  id: string;
  slug: string;
  name: string;
  status: "pesquisando" | "ativo" | "pausado" | "tge_anunciado" | "distribuido" | "descartado";
  /** Como o projeto é farmado: define a rotina de trabalho. */
  category: "liquidez" | "interacoes" | "perps" | null;
  /**
   * Nome do programa de pontos ("Pontos", "XP", "Marks"). `null` = o projeto
   * não tem programa. Serve de rótulo e de chave para exibir a aba de pontos.
   */
  pointsLabel: string | null;
  chain: string | null;
  priority: number;
  websiteUrl: string | null;
  discordUrl: string | null;
  twitterUrl: string | null;
  docsUrl: string | null;
  expectedTgeDate: string | null;
  notes: string | null;
  /** De qual entrada do catálogo da comunidade este projeto veio; null = cadastrado à mão. */
  adoptedFromId: string | null;
};

export const rawProjects: RawProject[] = [
  {
    id: "prj-meridian",
    slug: "meridian",
    name: "Meridian",
    status: "ativo",
    category: "interacoes",
    pointsLabel: null,
    chain: "Multi-chain",
    priority: 3,
    websiteUrl: "https://exemplo.com",
    discordUrl: null,
    twitterUrl: "https://x.com/exemplo",
    docsUrl: null,
    expectedTgeDate: null,
    notes: "Conta de e-mail é a principal. Perfis de navegador entraram depois.",
    adoptedFromId: null,
  },
  {
    id: "prj-solstice",
    slug: "solstice",
    name: "Solstice",
    status: "ativo",
    category: "interacoes",
    pointsLabel: null,
    chain: null,
    priority: 2,
    websiteUrl: null,
    discordUrl: null,
    twitterUrl: null,
    docsUrl: null,
    expectedTgeDate: null,
    notes: null,
    adoptedFromId: null,
  },
  {
    id: "prj-vertex",
    slug: "vertex-perp",
    name: "Vertex Perp",
    status: "ativo",
    category: "perps",
    pointsLabel: "Pontos",
    chain: "Arbitrum",
    priority: 3,
    websiteUrl: null,
    discordUrl: null,
    twitterUrl: null,
    docsUrl: null,
    expectedTgeDate: "2026-10-01",
    notes: "Maior alocação e mais contas. Volume é o critério que importa aqui.",
    adoptedFromId: null,
  },
  {
    id: "prj-prisma",
    slug: "prisma-dex",
    name: "Prisma DEX",
    status: "ativo",
    category: "perps",
    pointsLabel: "Pontos",
    chain: "zkSync Era",
    priority: 2,
    websiteUrl: null,
    discordUrl: null,
    twitterUrl: null,
    docsUrl: null,
    expectedTgeDate: null,
    notes: null,
    adoptedFromId: null,
  },
  {
    id: "prj-nebula",
    slug: "nebula",
    name: "Nebula",
    status: "ativo",
    category: "liquidez",
    pointsLabel: "XP",
    chain: null,
    priority: 3,
    websiteUrl: null,
    discordUrl: null,
    twitterUrl: null,
    docsUrl: null,
    expectedTgeDate: null,
    notes: "Aporte mais alto até agora. Saldo ainda não conferido.",
    adoptedFromId: null,
  },
];

export type RawProjectAccount = {
  projectId: string;
  accountId: string;
  status: "ativa" | "pausada" | "queimada";
  startedAt: string;
};

export const rawProjectAccounts: RawProjectAccount[] = [
  { projectId: "prj-meridian", accountId: "acc-email", status: "ativa", startedAt: "2026-06-25" },
  { projectId: "prj-meridian", accountId: "acc-chrome", status: "ativa", startedAt: "2026-06-25" },
  { projectId: "prj-meridian", accountId: "acc-brave", status: "ativa", startedAt: "2026-06-25" },
  { projectId: "prj-solstice", accountId: "acc-brave", status: "ativa", startedAt: "2026-06-25" },
  { projectId: "prj-solstice", accountId: "acc-chrome", status: "ativa", startedAt: "2026-06-25" },
  { projectId: "prj-vertex", accountId: "acc-brave", status: "ativa", startedAt: "2026-07-01" },
  { projectId: "prj-vertex", accountId: "acc-chrome", status: "ativa", startedAt: "2026-07-01" },
  { projectId: "prj-vertex", accountId: "acc-chrome-1", status: "ativa", startedAt: "2026-07-14" },
  { projectId: "prj-vertex", accountId: "acc-chrome-2", status: "ativa", startedAt: "2026-07-13" },
  { projectId: "prj-prisma", accountId: "acc-chrome", status: "ativa", startedAt: "2026-07-08" },
  { projectId: "prj-nebula", accountId: "acc-mbox", status: "ativa", startedAt: "2026-07-28" },
];

export type RawTransaction = {
  id: string;
  projectId: string;
  accountId: string;
  occurredAt: string;
  type:
    | "deposit"
    | "withdrawal"
    | "trade_pnl"
    | "yield"
    | "fee_gas"
    | "volume_traded"
    | "other";
  /** Valor em dólar na data do lançamento. */
  amountUsd: string;
  /** Preenchidos quando o aporte foi em token: "SOL", "1.5". */
  tokenSymbol: string | null;
  tokenAmount: string | null;
  description: string | null;
};

/**
 * Cotação informada manualmente.
 *
 * Sem API externa por decisão de projeto: o usuário atualiza quando quiser
 * (tipicamente antes da live semanal). Um token sem cotação cai de volta para
 * o valor em dólar registrado na data, e a interface avisa.
 */
export type RawTokenPrice = {
  symbol: string;
  priceUsd: string;
  updatedAt: string;
};

export const rawTokenPrices: RawTokenPrice[] = [
  { symbol: "SOL", priceUsd: "195.00", updatedAt: "2026-08-04" },
];

/**
 * Lançamentos. No modelo de razão, o saldo de cada par projeto×conta é a soma
 * de tudo que foi lançado: não existe registro de saldo em separado.
 *
 * Dados de demonstração.
 */
export const rawTransactions: RawTransaction[] = [
  // ---------------------------------------------------------------- Meridian
  { id: "tx-01", projectId: "prj-meridian", accountId: "acc-email", occurredAt: "2026-06-25", type: "deposit", amountUsd: "20.00", tokenSymbol: null, tokenAmount: null, description: "Depósito na plataforma" },
  { id: "tx-02", projectId: "prj-meridian", accountId: "acc-chrome", occurredAt: "2026-06-25", type: "deposit", amountUsd: "9.00", tokenSymbol: null, tokenAmount: null, description: "Novo aporte" },
  { id: "tx-03", projectId: "prj-meridian", accountId: "acc-brave", occurredAt: "2026-07-01", type: "deposit", amountUsd: "15.00", tokenSymbol: null, tokenAmount: null, description: "Depósito na plataforma" },
  { id: "tx-04", projectId: "prj-meridian", accountId: "acc-brave", occurredAt: "2026-07-07", type: "trade_pnl", amountUsd: "-7.67", tokenSymbol: null, tokenAmount: null, description: "Perda em trade" },
  { id: "tx-05", projectId: "prj-meridian", accountId: "acc-email", occurredAt: "2026-07-27", type: "yield", amountUsd: "1.40", tokenSymbol: null, tokenAmount: null, description: "Rendimento acumulado" },
  { id: "tx-06", projectId: "prj-meridian", accountId: "acc-chrome", occurredAt: "2026-07-27", type: "trade_pnl", amountUsd: "-0.40", tokenSymbol: null, tokenAmount: null, description: "Ajuste de posição" },

  // ---------------------------------------------------------------- Solstice
  { id: "tx-07", projectId: "prj-solstice", accountId: "acc-brave", occurredAt: "2026-06-25", type: "deposit", amountUsd: "14.00", tokenSymbol: null, tokenAmount: null, description: "Depósito na plataforma" },
  { id: "tx-08", projectId: "prj-solstice", accountId: "acc-chrome", occurredAt: "2026-06-25", type: "deposit", amountUsd: "9.00", tokenSymbol: null, tokenAmount: null, description: "Saldo restante" },
  { id: "tx-09", projectId: "prj-solstice", accountId: "acc-brave", occurredAt: "2026-07-26", type: "trade_pnl", amountUsd: "-0.90", tokenSymbol: null, tokenAmount: null, description: "Perda em trade" },
  { id: "tx-10", projectId: "prj-solstice", accountId: "acc-chrome", occurredAt: "2026-07-26", type: "yield", amountUsd: "0.45", tokenSymbol: null, tokenAmount: null, description: "Rendimento da pool" },

  // ------------------------------------------------------------- Vertex Perp
  { id: "tx-11", projectId: "prj-vertex", accountId: "acc-brave", occurredAt: "2026-07-01", type: "deposit", amountUsd: "20.00", tokenSymbol: null, tokenAmount: null, description: "Depósito na plataforma" },
  { id: "tx-12", projectId: "prj-vertex", accountId: "acc-chrome", occurredAt: "2026-07-01", type: "deposit", amountUsd: "20.00", tokenSymbol: null, tokenAmount: null, description: "Depósito na plataforma" },
  { id: "tx-13", projectId: "prj-vertex", accountId: "acc-chrome-2", occurredAt: "2026-07-13", type: "deposit", amountUsd: "5.00", tokenSymbol: null, tokenAmount: null, description: "Depósito na plataforma" },
  { id: "tx-14", projectId: "prj-vertex", accountId: "acc-chrome-1", occurredAt: "2026-07-14", type: "deposit", amountUsd: "5.00", tokenSymbol: null, tokenAmount: null, description: "Depósito na plataforma" },
  { id: "tx-15", projectId: "prj-vertex", accountId: "acc-chrome", occurredAt: "2026-07-24", type: "deposit", amountUsd: "20.00", tokenSymbol: null, tokenAmount: null, description: "Reforço de colateral" },
  // Volume operado não é caixa: alimenta metas e fica fora do saldo (§5).
  { id: "tx-16", projectId: "prj-vertex", accountId: "acc-chrome", occurredAt: "2026-07-25", type: "volume_traded", amountUsd: "2100.00", tokenSymbol: null, tokenAmount: null, description: "Volume acumulado na semana" },
  { id: "tx-17", projectId: "prj-vertex", accountId: "acc-brave", occurredAt: "2026-07-26", type: "volume_traded", amountUsd: "1350.00", tokenSymbol: null, tokenAmount: null, description: "Volume acumulado na semana" },
  { id: "tx-18", projectId: "prj-vertex", accountId: "acc-chrome-1", occurredAt: "2026-07-25", type: "trade_pnl", amountUsd: "-0.20", tokenSymbol: null, tokenAmount: null, description: "Perda em trade" },
  { id: "tx-19", projectId: "prj-vertex", accountId: "acc-chrome-2", occurredAt: "2026-07-25", type: "yield", amountUsd: "0.30", tokenSymbol: null, tokenAmount: null, description: "Funding recebido" },
  { id: "tx-20", projectId: "prj-vertex", accountId: "acc-brave", occurredAt: "2026-07-27", type: "yield", amountUsd: "2.80", tokenSymbol: null, tokenAmount: null, description: "Funding recebido" },
  { id: "tx-21", projectId: "prj-vertex", accountId: "acc-chrome", occurredAt: "2026-07-27", type: "yield", amountUsd: "1.50", tokenSymbol: null, tokenAmount: null, description: "Funding recebido" },

  // -------------------------------------------------------------- Prisma DEX
  { id: "tx-22", projectId: "prj-prisma", accountId: "acc-chrome", occurredAt: "2026-07-08", type: "deposit", amountUsd: "20.00", tokenSymbol: null, tokenAmount: null, description: "Depósito na plataforma" },
  { id: "tx-23", projectId: "prj-prisma", accountId: "acc-chrome", occurredAt: "2026-07-26", type: "volume_traded", amountUsd: "1200.00", tokenSymbol: null, tokenAmount: null, description: "Volume acumulado na semana" },
  { id: "tx-24", projectId: "prj-prisma", accountId: "acc-chrome", occurredAt: "2026-07-26", type: "trade_pnl", amountUsd: "-1.10", tokenSymbol: null, tokenAmount: null, description: "Perda em trade" },

  // ------------------------------------------------------------------ Nebula
  // Aporte em token: o dólar fica congelado na data, mas a posição de 1 SOL é
  // revalorizada pela cotação atual: é o que revela ganho de preço.
  { id: "tx-25", projectId: "prj-nebula", accountId: "acc-mbox", occurredAt: "2026-07-28", type: "deposit", amountUsd: "180.00", tokenSymbol: "SOL", tokenAmount: "1", description: "Depósito de 1 SOL a $180" },
];

export type RawTask = {
  id: string;
  projectId: string;
  accountId: string | null;
  title: string;
  description: string | null;
  recurrence: "none" | "daily" | "weekly" | "monthly" | "every_n_days";
  intervalDays: number | null;
  dueDate: string | null;
  isActive: boolean;
};

export const rawTasks: RawTask[] = [
  {
    id: "tsk-01",
    projectId: "prj-vertex",
    accountId: null,
    title: "Executar 3 trades",
    description: "Volume conta para o critério de elegibilidade.",
    recurrence: "daily",
    intervalDays: null,
    dueDate: null,
    isActive: true,
  },
  {
    id: "tsk-02",
    projectId: "prj-meridian",
    accountId: null,
    title: "Check-in diário",
    description: null,
    recurrence: "daily",
    intervalDays: null,
    dueDate: null,
    isActive: true,
  },
  {
    id: "tsk-03",
    projectId: "prj-prisma",
    accountId: "acc-chrome",
    title: "Fechar volume da semana",
    description: "Meta semanal de volume no perp.",
    recurrence: "weekly",
    intervalDays: null,
    dueDate: null,
    isActive: true,
  },
  {
    id: "tsk-04",
    projectId: "prj-solstice",
    accountId: null,
    title: "Quest de testnet encerra",
    description: "Última janela para completar as tarefas da testnet.",
    recurrence: "none",
    intervalDays: null,
    dueDate: "2026-08-15",
    isActive: true,
  },
  {
    id: "tsk-05",
    projectId: "prj-nebula",
    accountId: "acc-mbox",
    title: "Conferir saldo depois do depósito",
    description: "Registrar o saldo assim que a plataforma creditar.",
    recurrence: "none",
    intervalDays: null,
    dueDate: "2026-07-30",
    isActive: true,
  },
  {
    id: "tsk-06",
    projectId: "prj-vertex",
    accountId: "acc-chrome",
    title: "Reforçar colateral",
    description: null,
    recurrence: "every_n_days",
    intervalDays: 10,
    dueDate: null,
    isActive: true,
  },
];

/** Ocorrências já materializadas: o motor de recorrência entra na fase 4. */
export type RawTaskOccurrence = {
  id: string;
  taskId: string;
  accountId: string;
  dueDate: string;
  completedAt: string | null;
  skipped: boolean;
};

export const rawTaskOccurrences: RawTaskOccurrence[] = [
  // Vertex Perp: "Executar 3 trades", 4 contas
  { id: "occ-01", taskId: "tsk-01", accountId: "acc-brave", dueDate: "2026-07-28", completedAt: null, skipped: false },
  { id: "occ-02", taskId: "tsk-01", accountId: "acc-chrome", dueDate: "2026-07-28", completedAt: null, skipped: false },
  { id: "occ-03", taskId: "tsk-01", accountId: "acc-chrome-1", dueDate: "2026-07-28", completedAt: null, skipped: false },
  { id: "occ-04", taskId: "tsk-01", accountId: "acc-chrome-2", dueDate: "2026-07-28", completedAt: null, skipped: false },
  // Atrasadas: ontem, duas contas não fizeram
  { id: "occ-05", taskId: "tsk-01", accountId: "acc-chrome-1", dueDate: "2026-07-27", completedAt: null, skipped: false },
  { id: "occ-06", taskId: "tsk-01", accountId: "acc-chrome-2", dueDate: "2026-07-27", completedAt: null, skipped: false },
  { id: "occ-07", taskId: "tsk-01", accountId: "acc-brave", dueDate: "2026-07-27", completedAt: "2026-07-27T18:20:00Z", skipped: false },
  { id: "occ-08", taskId: "tsk-01", accountId: "acc-chrome", dueDate: "2026-07-27", completedAt: "2026-07-27T18:35:00Z", skipped: false },
  // Meridian: check-in diário, 3 contas
  { id: "occ-09", taskId: "tsk-02", accountId: "acc-email", dueDate: "2026-07-28", completedAt: null, skipped: false },
  { id: "occ-10", taskId: "tsk-02", accountId: "acc-chrome", dueDate: "2026-07-28", completedAt: null, skipped: false },
  { id: "occ-11", taskId: "tsk-02", accountId: "acc-brave", dueDate: "2026-07-28", completedAt: "2026-07-28T09:10:00Z", skipped: false },
  { id: "occ-12", taskId: "tsk-02", accountId: "acc-email", dueDate: "2026-07-26", completedAt: null, skipped: false },
  // Prisma DEX: semanal
  { id: "occ-13", taskId: "tsk-03", accountId: "acc-chrome", dueDate: "2026-08-02", completedAt: null, skipped: false },
  // Solstice: prazo fixo
  { id: "occ-14", taskId: "tsk-04", accountId: "acc-brave", dueDate: "2026-08-15", completedAt: null, skipped: false },
  { id: "occ-15", taskId: "tsk-04", accountId: "acc-chrome", dueDate: "2026-08-15", completedAt: null, skipped: false },
  // Nebula: prazo fixo próximo
  { id: "occ-16", taskId: "tsk-05", accountId: "acc-mbox", dueDate: "2026-07-30", completedAt: null, skipped: false },
  // Vertex Perp: a cada 10 dias
  { id: "occ-17", taskId: "tsk-06", accountId: "acc-chrome", dueDate: "2026-08-03", completedAt: null, skipped: false },
];

export type RawGoal = {
  id: string;
  projectId: string;
  accountId: string | null;
  title: string;
  metric: "volume_usd" | "balance_usd" | "tx_count" | "days_active";
  targetValue: string;
  deadline: string | null;
  achievedAt: string | null;
};

export type RawGoalEntry = {
  id: string;
  goalId: string;
  occurredAt: string;
  value: string;
  note: string | null;
};

export const rawGoals: RawGoal[] = [
  {
    id: "gol-01",
    projectId: "prj-vertex",
    accountId: null,
    title: "Volume acumulado no perp",
    metric: "volume_usd",
    targetValue: "10000.00",
    deadline: "2026-09-30",
    achievedAt: null,
  },
  {
    id: "gol-02",
    projectId: "prj-prisma",
    accountId: "acc-chrome",
    title: "Volume mínimo para elegibilidade",
    metric: "volume_usd",
    targetValue: "5000.00",
    deadline: null,
    achievedAt: null,
  },
];

/**
 * Lançamentos de progresso das metas acima.
 *
 * Duas metas de volume, cada uma com o próprio histórico: é o caso que motivou
 * a mudança, em que várias metas do mesmo projeto e da mesma métrica precisam
 * de números independentes.
 */
export const rawGoalEntries: RawGoalEntry[] = [
  {
    id: "gle-01",
    goalId: "gol-01",
    occurredAt: "2026-07-10",
    value: "2500.00",
    note: "Semana de abertura",
  },
  {
    id: "gle-02",
    goalId: "gol-01",
    occurredAt: "2026-07-24",
    value: "1800.00",
    note: null,
  },
  {
    id: "gle-03",
    goalId: "gol-02",
    occurredAt: "2026-07-20",
    value: "900.00",
    note: null,
  },
];

export type RawAirdropClaim = {
  id: string;
  projectId: string;
  accountId: string;
  receivedAt: string;
  tokenSymbol: string;
  /** Nulos quando o valor foi lançado direto em dólar: ver `airdropClaims`. */
  tokenAmount: string | null;
  priceUsd: string | null;
  valueUsd: string;
};

/** Vazio de propósito: nenhum TGE aconteceu ainda. Exercita o estado vazio. */
export const rawAirdropClaims: RawAirdropClaim[] = [];

/**
 * Dataset inicial entregue ao provider client.
 *
 * As cópias impedem que uma mutação acidental no navegador altere os módulos
 * importados: o "restaurar dados originais" precisa de uma base intacta.
 */
export function datasetInicial() {
  return {
    accounts: [...rawAccounts],
    projects: [...rawProjects],
    projectAccounts: [...rawProjectAccounts],
    transactions: [...rawTransactions],
    tasks: [...rawTasks],
    taskOccurrences: [...rawTaskOccurrences],
    goals: [...rawGoals],
    goalEntries: [...rawGoalEntries],
    tokenPrices: [...rawTokenPrices],
    pointsSnapshots: [...rawPointsSnapshots],
    volumeSnapshots: [...rawVolumeSnapshots],
    airdropClaims: [...rawAirdropClaims],
    catalogProjects: [...rawCatalogProjects],
  };
}

export type RawVolumeSnapshot = {
  id: string;
  projectId: string;
  accountId: string;
  takenAt: string;
  /** `numeric` como string, igual aos demais valores. */
  volumeUsd: string;
  note: string | null;
};

export type RawPointsSnapshot = {
  id: string;
  projectId: string;
  accountId: string;
  takenAt: string;
  /** `numeric` como string, igual aos demais valores. */
  points: string;
  note: string | null;
};

/**
 * Fotos do saldo de pontos. Mesmo princípio dos saldos em dólar: o programa
 * mostra um acumulado, não um extrato: então o que se registra é o total do
 * dia, e o ganho do período sai da diferença entre duas fotos.
 *
 * Dados de exemplo.
 */
/**
 * Medições de volume acumulado. Duas datas para o mesmo par exercitam o cálculo
 * da variação, que é o número que a tela mostra.
 */
export const rawVolumeSnapshots: RawVolumeSnapshot[] = [
  { id: "vol-01", projectId: "prj-vertex", accountId: "acc-chrome", takenAt: "2026-07-20", volumeUsd: "1250.00", note: null },
  { id: "vol-02", projectId: "prj-vertex", accountId: "acc-chrome", takenAt: "2026-07-27", volumeUsd: "3450.00", note: "semana de volume alto" },
  { id: "vol-03", projectId: "prj-prisma", accountId: "acc-chrome", takenAt: "2026-07-26", volumeUsd: "1200.00", note: null },
];

export const rawPointsSnapshots: RawPointsSnapshot[] = [
  // Vertex Perp: quatro contas, duas medições
  { id: "pts-01", projectId: "prj-vertex", accountId: "acc-brave", takenAt: "2026-07-20", points: "8400.0000", note: null },
  { id: "pts-02", projectId: "prj-vertex", accountId: "acc-chrome", takenAt: "2026-07-20", points: "15200.0000", note: null },
  { id: "pts-03", projectId: "prj-vertex", accountId: "acc-chrome-1", takenAt: "2026-07-20", points: "1100.0000", note: null },
  { id: "pts-04", projectId: "prj-vertex", accountId: "acc-chrome-2", takenAt: "2026-07-20", points: "1250.0000", note: null },
  { id: "pts-05", projectId: "prj-vertex", accountId: "acc-brave", takenAt: "2026-07-27", points: "11750.0000", note: "Semana de volume alto" },
  { id: "pts-06", projectId: "prj-vertex", accountId: "acc-chrome", takenAt: "2026-07-27", points: "21400.0000", note: null },
  { id: "pts-07", projectId: "prj-vertex", accountId: "acc-chrome-1", takenAt: "2026-07-27", points: "1480.0000", note: null },
  { id: "pts-08", projectId: "prj-vertex", accountId: "acc-chrome-2", takenAt: "2026-07-27", points: "1620.0000", note: null },
  // Prisma DEX: uma conta
  { id: "pts-09", projectId: "prj-prisma", accountId: "acc-chrome", takenAt: "2026-07-19", points: "3200.0000", note: null },
  { id: "pts-10", projectId: "prj-prisma", accountId: "acc-chrome", takenAt: "2026-07-26", points: "4850.5000", note: "Bônus de maker" },
  // Nebula: programa recém-iniciado, só uma medição
  { id: "pts-11", projectId: "prj-nebula", accountId: "acc-mbox", takenAt: "2026-07-28", points: "500.0000", note: "Pontos de entrada" },
];

/**
 * Solicitações de acesso.
 *
 * O controle escolhido é cadastro livre com aprovação manual: qualquer pessoa
 * se cadastra e fica em `pendente` até ser liberada. Ver ARCHITECTURE.md §9.4.
 *
 * Dados de demonstração.
 */
/**
 * Entrada do catálogo de projetos da comunidade (ARCHITECTURE §13).
 *
 * Cópia dos campos editoriais de um projeto no momento em que alguém decidiu
 * destacá-lo, não uma janela para o projeto original: ver a nota em
 * `db/schema.ts` sobre por que a independência importa.
 */
export type RawCatalogProject = {
  id: string;
  slug: string;
  name: string;
  category: "liquidez" | "interacoes" | "perps" | null;
  pointsLabel: string | null;
  chain: string | null;
  priority: number;
  websiteUrl: string | null;
  discordUrl: string | null;
  twitterUrl: string | null;
  docsUrl: string | null;
  expectedTgeDate: string | null;
  summary: string | null;
  createdBy: string;
  sourceProjectId: string | null;
  /** null = fora do catálogo. É o único estado de "despublicado" que existe. */
  publishedAt: string | null;
};

/** Vazio de propósito: nasce assim que alguém publica pela tela. */
export const rawCatalogProjects: RawCatalogProject[] = [];

export type RawMember = {
  id: string;
  name: string;
  email: string;
  status: "pendente" | "aprovado" | "recusado";
  /** Quando a pessoa se cadastrou. */
  registeredAt: string;
  /** Quando foi aprovada ou recusada; null enquanto pendente. */
  reviewedAt: string | null;
  /** Observação de quem revisou: por que recusou, de onde veio, etc. */
  note: string | null;
};

export const rawMembers: RawMember[] = [
  { id: "mem-01", name: "Camila Duarte", email: "camila.duarte@exemplo.com", status: "pendente", registeredAt: "2026-07-27", reviewedAt: null, note: null },
  { id: "mem-02", name: "Rafael Lima", email: "rafael.lima@exemplo.com", status: "pendente", registeredAt: "2026-07-26", reviewedAt: null, note: null },
  { id: "mem-03", name: "Ana Beatriz", email: "ana.beatriz@exemplo.com", status: "pendente", registeredAt: "2026-07-25", reviewedAt: null, note: null },
  { id: "mem-04", name: "Diego Ramos", email: "diego.ramos@exemplo.com", status: "aprovado", registeredAt: "2026-07-10", reviewedAt: "2026-07-11", note: null },
  { id: "mem-05", name: "Juliana Alves", email: "juliana.alves@exemplo.com", status: "aprovado", registeredAt: "2026-07-05", reviewedAt: "2026-07-05", note: null },
  { id: "mem-06", name: "Marcos Vinícius", email: "marcos.v@exemplo.com", status: "aprovado", registeredAt: "2026-06-20", reviewedAt: "2026-06-21", note: null },
  { id: "mem-07", name: "Teste Teste", email: "teste@teste.com", status: "recusado", registeredAt: "2026-07-22", reviewedAt: "2026-07-22", note: "Sem assinatura ativa" },
];
