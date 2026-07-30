/**
 * Dados de desenvolvimento — substituídos pelo Neon na fase de backend.
 *
 * Formato deliberadamente igual ao que o Drizzle devolve: valores `numeric`
 * como STRING, datas como "YYYY-MM-DD". A agregação em `db/queries` já opera
 * sobre o formato real, então a troca por SQL não muda a lógica.
 *
 * PROCEDÊNCIA DOS DADOS
 *  - Transações e os dois snapshots de Nansen/brave: reais, vindos da planilha.
 *  - Demais snapshots, tarefas e metas: exemplos para dar o que ver às telas.
 *  - `chain` dos projetos: placeholder — conferir antes de levar a sério.
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
    label: "arturnery97@gmail.com",
    walletAddress: null,
    email: "arturnery97@gmail.com",
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
  /** Como o projeto é farmado — define a rotina de trabalho. */
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
};

export const rawProjects: RawProject[] = [
  {
    id: "prj-nansen",
    slug: "nansen",
    name: "Nansen",
    status: "ativo",
    category: "interacoes",
    pointsLabel: null,
    chain: "Multi-chain",
    priority: 3,
    websiteUrl: "https://nansen.ai",
    discordUrl: null,
    twitterUrl: "https://x.com/nansen_ai",
    docsUrl: null,
    expectedTgeDate: null,
    notes: "Conta de e-mail é a principal. Perfis de navegador entraram depois.",
  },
  {
    id: "prj-minara",
    slug: "minara",
    name: "Minara",
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
  },
  {
    id: "prj-ondo",
    slug: "ondo-perp",
    name: "Ondo Perp",
    status: "ativo",
    category: "perps",
    pointsLabel: "Pontos",
    chain: "Ondo Chain",
    priority: 5,
    websiteUrl: null,
    discordUrl: null,
    twitterUrl: null,
    docsUrl: null,
    expectedTgeDate: "2026-10-01",
    notes: "Maior alocação e mais contas. Volume é o critério que importa aqui.",
  },
  {
    id: "prj-lighter",
    slug: "lighter",
    name: "Lighter",
    status: "ativo",
    category: "perps",
    pointsLabel: "Pontos",
    chain: "zkSync Era",
    priority: 3,
    websiteUrl: null,
    discordUrl: null,
    twitterUrl: null,
    docsUrl: null,
    expectedTgeDate: null,
    notes: null,
  },
  {
    id: "prj-saturn",
    slug: "saturn",
    name: "Saturn",
    status: "ativo",
    category: "liquidez",
    pointsLabel: "XP",
    chain: null,
    priority: 4,
    websiteUrl: null,
    discordUrl: null,
    twitterUrl: null,
    docsUrl: null,
    expectedTgeDate: null,
    notes: "Aporte mais alto até agora. Saldo ainda não conferido.",
  },
];

export type RawProjectAccount = {
  projectId: string;
  accountId: string;
  status: "ativa" | "pausada" | "queimada";
  startedAt: string;
};

export const rawProjectAccounts: RawProjectAccount[] = [
  { projectId: "prj-nansen", accountId: "acc-email", status: "ativa", startedAt: "2026-06-25" },
  { projectId: "prj-nansen", accountId: "acc-chrome", status: "ativa", startedAt: "2026-06-25" },
  { projectId: "prj-nansen", accountId: "acc-brave", status: "ativa", startedAt: "2026-06-25" },
  { projectId: "prj-minara", accountId: "acc-brave", status: "ativa", startedAt: "2026-06-25" },
  { projectId: "prj-minara", accountId: "acc-chrome", status: "ativa", startedAt: "2026-06-25" },
  { projectId: "prj-ondo", accountId: "acc-brave", status: "ativa", startedAt: "2026-07-01" },
  { projectId: "prj-ondo", accountId: "acc-chrome", status: "ativa", startedAt: "2026-07-01" },
  { projectId: "prj-ondo", accountId: "acc-chrome-1", status: "ativa", startedAt: "2026-07-14" },
  { projectId: "prj-ondo", accountId: "acc-chrome-2", status: "ativa", startedAt: "2026-07-13" },
  { projectId: "prj-lighter", accountId: "acc-chrome", status: "ativa", startedAt: "2026-07-08" },
  { projectId: "prj-saturn", accountId: "acc-mbox", status: "ativa", startedAt: "2026-07-28" },
];

export type RawTransaction = {
  id: string;
  projectId: string;
  accountId: string;
  occurredAt: string;
  type: "deposit" | "withdrawal" | "trade_pnl" | "fee_gas" | "volume_traded" | "other";
  amountUsd: string;
  description: string | null;
};

/** Reais, transcritas da planilha. */
export const rawTransactions: RawTransaction[] = [
  {
    id: "tx-01",
    projectId: "prj-nansen",
    accountId: "acc-email",
    occurredAt: "2026-06-25",
    type: "deposit",
    amountUsd: "20.00",
    description: "Depósito na plataforma",
  },
  {
    id: "tx-02",
    projectId: "prj-minara",
    accountId: "acc-brave",
    occurredAt: "2026-06-25",
    type: "deposit",
    amountUsd: "14.00",
    description: "Depósito na plataforma",
  },
  {
    id: "tx-03",
    projectId: "prj-minara",
    accountId: "acc-chrome",
    occurredAt: "2026-06-25",
    type: "deposit",
    amountUsd: "9.00",
    description: "Saldo restante",
  },
  {
    id: "tx-04",
    projectId: "prj-nansen",
    accountId: "acc-chrome",
    occurredAt: "2026-06-25",
    type: "deposit",
    amountUsd: "9.00",
    description: "Novo aporte",
  },
  {
    id: "tx-05",
    projectId: "prj-nansen",
    accountId: "acc-chrome",
    occurredAt: "2026-07-01",
    type: "trade_pnl",
    amountUsd: "0.00",
    description: "Perda em trade",
  },
  {
    id: "tx-06",
    projectId: "prj-ondo",
    accountId: "acc-brave",
    occurredAt: "2026-07-01",
    type: "deposit",
    amountUsd: "20.00",
    description: "Depósito na plataforma",
  },
  {
    id: "tx-07",
    projectId: "prj-ondo",
    accountId: "acc-chrome",
    occurredAt: "2026-07-01",
    type: "deposit",
    amountUsd: "20.00",
    description: "Depósito na plataforma",
  },
  {
    id: "tx-08",
    projectId: "prj-lighter",
    accountId: "acc-chrome",
    occurredAt: "2026-07-08",
    type: "deposit",
    amountUsd: "20.00",
    description: "Depósito na plataforma",
  },
  {
    id: "tx-09",
    projectId: "prj-ondo",
    accountId: "acc-chrome-2",
    occurredAt: "2026-07-13",
    type: "deposit",
    amountUsd: "5.00",
    description: "Depósito na plataforma",
  },
  {
    id: "tx-10",
    projectId: "prj-ondo",
    accountId: "acc-chrome-1",
    occurredAt: "2026-07-14",
    type: "deposit",
    amountUsd: "5.00",
    description: "Depósito na plataforma",
  },
  {
    id: "tx-11",
    projectId: "prj-ondo",
    accountId: "acc-chrome",
    occurredAt: "2026-07-24",
    type: "deposit",
    amountUsd: "20.00",
    description: "Depósito na plataforma",
  },
  {
    id: "tx-12",
    projectId: "prj-saturn",
    accountId: "acc-mbox",
    occurredAt: "2026-07-28",
    type: "deposit",
    amountUsd: "100.00",
    description: "Depósito na plataforma",
  },
  // Volume operado: não é caixa, alimenta metas (ARCHITECTURE.md §4.3-C).
  {
    id: "tx-13",
    projectId: "prj-ondo",
    accountId: "acc-chrome",
    occurredAt: "2026-07-25",
    type: "volume_traded",
    amountUsd: "2100.00",
    description: "Volume acumulado na semana",
  },
  {
    id: "tx-14",
    projectId: "prj-ondo",
    accountId: "acc-brave",
    occurredAt: "2026-07-26",
    type: "volume_traded",
    amountUsd: "1350.00",
    description: "Volume acumulado na semana",
  },
  {
    id: "tx-15",
    projectId: "prj-lighter",
    accountId: "acc-chrome",
    occurredAt: "2026-07-26",
    type: "volume_traded",
    amountUsd: "1200.00",
    description: "Volume acumulado na semana",
  },
];

export type RawBalanceSnapshot = {
  id: string;
  projectId: string;
  accountId: string;
  takenAt: string;
  balanceUsd: string;
  /** Explica a variação em relação ao saldo anterior. */
  note: string | null;
};

export const rawBalanceSnapshots: RawBalanceSnapshot[] = [
  // Reais — da planilha. Note que não há depósito registrado para este par:
  // a interface mostra "saldo sem aporte" em vez de esconder a inconsistência.
  {
    id: "snp-01",
    projectId: "prj-nansen",
    accountId: "acc-brave",
    takenAt: "2026-07-01",
    balanceUsd: "15.00",
    note: null,
  },
  {
    id: "snp-02",
    projectId: "prj-nansen",
    accountId: "acc-brave",
    takenAt: "2026-07-07",
    balanceUsd: "7.33",
    note: "Perda em trade",
  },
  // Exemplos.
  {
    id: "snp-03",
    projectId: "prj-nansen",
    accountId: "acc-email",
    takenAt: "2026-07-27",
    balanceUsd: "21.40",
    note: "Rendimento do DeFi",
  },
  {
    id: "snp-04",
    projectId: "prj-nansen",
    accountId: "acc-chrome",
    takenAt: "2026-07-27",
    balanceUsd: "8.60",
    note: null,
  },
  {
    id: "snp-05",
    projectId: "prj-minara",
    accountId: "acc-brave",
    takenAt: "2026-07-26",
    balanceUsd: "13.10",
    note: null,
  },
  {
    id: "snp-06",
    projectId: "prj-minara",
    accountId: "acc-chrome",
    takenAt: "2026-07-26",
    balanceUsd: "9.45",
    note: null,
  },
  {
    id: "snp-07",
    projectId: "prj-ondo",
    accountId: "acc-brave",
    takenAt: "2026-07-27",
    balanceUsd: "22.80",
    note: null,
  },
  {
    id: "snp-08",
    projectId: "prj-ondo",
    accountId: "acc-chrome",
    takenAt: "2026-07-27",
    balanceUsd: "41.50",
    note: null,
  },
  {
    id: "snp-09",
    projectId: "prj-ondo",
    accountId: "acc-chrome-1",
    takenAt: "2026-07-25",
    balanceUsd: "4.80",
    note: null,
  },
  {
    id: "snp-10",
    projectId: "prj-ondo",
    accountId: "acc-chrome-2",
    takenAt: "2026-07-25",
    balanceUsd: "5.30",
    note: null,
  },
  {
    id: "snp-11",
    projectId: "prj-lighter",
    accountId: "acc-chrome",
    takenAt: "2026-07-26",
    balanceUsd: "18.90",
    note: null,
  },
  // Saturn/mbox de propósito sem snapshot: exercita o estado "aporte sem saldo
  // confirmado" e o indicador de cobertura do dashboard.
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
    projectId: "prj-ondo",
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
    projectId: "prj-nansen",
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
    projectId: "prj-lighter",
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
    projectId: "prj-minara",
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
    projectId: "prj-saturn",
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
    projectId: "prj-ondo",
    accountId: "acc-chrome",
    title: "Reforçar colateral",
    description: null,
    recurrence: "every_n_days",
    intervalDays: 10,
    dueDate: null,
    isActive: true,
  },
];

/** Ocorrências já materializadas — o motor de recorrência entra na fase 4. */
export type RawTaskOccurrence = {
  id: string;
  taskId: string;
  accountId: string;
  dueDate: string;
  completedAt: string | null;
  skipped: boolean;
};

export const rawTaskOccurrences: RawTaskOccurrence[] = [
  // Ondo Perp — "Executar 3 trades", 4 contas
  { id: "occ-01", taskId: "tsk-01", accountId: "acc-brave", dueDate: "2026-07-28", completedAt: null, skipped: false },
  { id: "occ-02", taskId: "tsk-01", accountId: "acc-chrome", dueDate: "2026-07-28", completedAt: null, skipped: false },
  { id: "occ-03", taskId: "tsk-01", accountId: "acc-chrome-1", dueDate: "2026-07-28", completedAt: null, skipped: false },
  { id: "occ-04", taskId: "tsk-01", accountId: "acc-chrome-2", dueDate: "2026-07-28", completedAt: null, skipped: false },
  // Atrasadas: ontem, duas contas não fizeram
  { id: "occ-05", taskId: "tsk-01", accountId: "acc-chrome-1", dueDate: "2026-07-27", completedAt: null, skipped: false },
  { id: "occ-06", taskId: "tsk-01", accountId: "acc-chrome-2", dueDate: "2026-07-27", completedAt: null, skipped: false },
  { id: "occ-07", taskId: "tsk-01", accountId: "acc-brave", dueDate: "2026-07-27", completedAt: "2026-07-27T18:20:00Z", skipped: false },
  { id: "occ-08", taskId: "tsk-01", accountId: "acc-chrome", dueDate: "2026-07-27", completedAt: "2026-07-27T18:35:00Z", skipped: false },
  // Nansen — check-in diário, 3 contas
  { id: "occ-09", taskId: "tsk-02", accountId: "acc-email", dueDate: "2026-07-28", completedAt: null, skipped: false },
  { id: "occ-10", taskId: "tsk-02", accountId: "acc-chrome", dueDate: "2026-07-28", completedAt: null, skipped: false },
  { id: "occ-11", taskId: "tsk-02", accountId: "acc-brave", dueDate: "2026-07-28", completedAt: "2026-07-28T09:10:00Z", skipped: false },
  { id: "occ-12", taskId: "tsk-02", accountId: "acc-email", dueDate: "2026-07-26", completedAt: null, skipped: false },
  // Lighter — semanal
  { id: "occ-13", taskId: "tsk-03", accountId: "acc-chrome", dueDate: "2026-08-02", completedAt: null, skipped: false },
  // Minara — prazo fixo
  { id: "occ-14", taskId: "tsk-04", accountId: "acc-brave", dueDate: "2026-08-15", completedAt: null, skipped: false },
  { id: "occ-15", taskId: "tsk-04", accountId: "acc-chrome", dueDate: "2026-08-15", completedAt: null, skipped: false },
  // Saturn — prazo fixo próximo
  { id: "occ-16", taskId: "tsk-05", accountId: "acc-mbox", dueDate: "2026-07-30", completedAt: null, skipped: false },
  // Ondo Perp — a cada 10 dias
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

export const rawGoals: RawGoal[] = [
  {
    id: "gol-01",
    projectId: "prj-ondo",
    accountId: null,
    title: "Volume acumulado no perp",
    metric: "volume_usd",
    targetValue: "10000.00",
    deadline: "2026-09-30",
    achievedAt: null,
  },
  {
    id: "gol-02",
    projectId: "prj-lighter",
    accountId: "acc-chrome",
    title: "Volume mínimo para elegibilidade",
    metric: "volume_usd",
    targetValue: "5000.00",
    deadline: null,
    achievedAt: null,
  },
];

export type RawAirdropClaim = {
  id: string;
  projectId: string;
  accountId: string;
  receivedAt: string;
  tokenSymbol: string;
  tokenAmount: string;
  priceUsd: string;
  valueUsd: string;
};

/** Vazio de propósito: nenhum TGE aconteceu ainda. Exercita o estado vazio. */
export const rawAirdropClaims: RawAirdropClaim[] = [];

/**
 * Dataset inicial entregue ao provider client.
 *
 * As cópias impedem que uma mutação acidental no navegador altere os módulos
 * importados — o "restaurar dados originais" precisa de uma base intacta.
 */
export function datasetInicial() {
  return {
    accounts: [...rawAccounts],
    projects: [...rawProjects],
    projectAccounts: [...rawProjectAccounts],
    transactions: [...rawTransactions],
    balanceSnapshots: [...rawBalanceSnapshots],
    tasks: [...rawTasks],
    taskOccurrences: [...rawTaskOccurrences],
    goals: [...rawGoals],
    pointsSnapshots: [...rawPointsSnapshots],
    airdropClaims: [...rawAirdropClaims],
  };
}

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
 * mostra um acumulado, não um extrato — então o que se registra é o total do
 * dia, e o ganho do período sai da diferença entre duas fotos.
 *
 * Dados de exemplo.
 */
export const rawPointsSnapshots: RawPointsSnapshot[] = [
  // Ondo Perp — quatro contas, duas medições
  { id: "pts-01", projectId: "prj-ondo", accountId: "acc-brave", takenAt: "2026-07-20", points: "8400.0000", note: null },
  { id: "pts-02", projectId: "prj-ondo", accountId: "acc-chrome", takenAt: "2026-07-20", points: "15200.0000", note: null },
  { id: "pts-03", projectId: "prj-ondo", accountId: "acc-chrome-1", takenAt: "2026-07-20", points: "1100.0000", note: null },
  { id: "pts-04", projectId: "prj-ondo", accountId: "acc-chrome-2", takenAt: "2026-07-20", points: "1250.0000", note: null },
  { id: "pts-05", projectId: "prj-ondo", accountId: "acc-brave", takenAt: "2026-07-27", points: "11750.0000", note: "Semana de volume alto" },
  { id: "pts-06", projectId: "prj-ondo", accountId: "acc-chrome", takenAt: "2026-07-27", points: "21400.0000", note: null },
  { id: "pts-07", projectId: "prj-ondo", accountId: "acc-chrome-1", takenAt: "2026-07-27", points: "1480.0000", note: null },
  { id: "pts-08", projectId: "prj-ondo", accountId: "acc-chrome-2", takenAt: "2026-07-27", points: "1620.0000", note: null },
  // Lighter — uma conta
  { id: "pts-09", projectId: "prj-lighter", accountId: "acc-chrome", takenAt: "2026-07-19", points: "3200.0000", note: null },
  { id: "pts-10", projectId: "prj-lighter", accountId: "acc-chrome", takenAt: "2026-07-26", points: "4850.5000", note: "Bônus de maker" },
  // Saturn — programa recém-iniciado, só uma medição
  { id: "pts-11", projectId: "prj-saturn", accountId: "acc-mbox", takenAt: "2026-07-28", points: "500.0000", note: "Pontos de entrada" },
];
