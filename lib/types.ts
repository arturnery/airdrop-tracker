import type { Cents } from "./money";

/**
 * View models consumidos pelas telas.
 *
 * Estes tipos são o contrato entre a UI e a camada de dados. Hoje `db/queries`
 * devolve fixtures; na fase de backend passa a devolver o resultado do Drizzle.
 * O formato não muda, então nenhuma tela precisa ser tocada.
 */

export type ProjectStatus =
  | "pesquisando"
  | "ativo"
  | "pausado"
  | "tge_anunciado"
  | "distribuido"
  | "descartado";

export type ProjectAccountStatus = "ativa" | "pausada" | "queimada";

/** Como o projeto é farmado. Define a rotina e permite filtrar por tipo de esforço. */
export type ProjectCategory = "liquidez" | "interacoes" | "perps";

export type TransactionType =
  | "deposit"
  | "withdrawal"
  | "trade_pnl"
  | "fee_gas"
  | "volume_traded"
  | "other";

export type Recurrence =
  | "none"
  | "daily"
  | "weekly"
  | "monthly"
  | "every_n_days";

export type GoalMetric = "volume_usd" | "balance_usd" | "tx_count" | "days_active";

/** Datas trafegam como "YYYY-MM-DD" — sem timezone, ver ARCHITECTURE.md §5. */
export type IsoDate = string;

// ------------------------------------------------------------------ dashboard

export type FinancialSummary = {
  aportado: Cents;
  retirado: Cents;
  taxas: Cents;
  pnlTrades: Cents;
  airdrops: Cents;
  exposicao: Cents;
  resultado: Cents;
  /** null quando não há aporte — evita divisão por zero virar Infinity na tela. */
  roi: number | null;
};

export type DashboardSummary = FinancialSummary & {
  projetosAtivos: number;
  projetosTotal: number;
  contasAtivas: number;
  tarefasHoje: number;
  tarefasAtrasadas: number;
  /** Pares projeto×conta com saldo registrado, para medir confiança na exposição. */
  paresComSaldo: number;
  paresTotal: number;
};

export type CapitalPorProjeto = {
  slug: string;
  nome: string;
  aportado: Cents;
  exposicao: Cents;
};

// ------------------------------------------------------------------- projetos

export type ProjectSummary = {
  id: string;
  slug: string;
  nome: string;
  status: ProjectStatus;
  categoria: ProjectCategory | null;
  chain: string | null;
  prioridade: number;
  aportado: Cents;
  exposicao: Cents;
  resultado: Cents;
  roi: number | null;
  contas: number;
  tarefasPendentes: number;
  tarefasAtrasadas: number;
  ultimaAtividade: IsoDate | null;
  tgePrevisto: IsoDate | null;
};

export type ProjectLinks = {
  website: string | null;
  discord: string | null;
  twitter: string | null;
  docs: string | null;
};

/** Uma linha da tabela "conta por conta" dentro de um projeto. */
export type ProjectAccountRow = {
  contaId: string;
  label: string;
  status: ProjectAccountStatus;
  aportado: Cents;
  /** null quando nunca houve snapshot — diferente de zero. */
  saldo: Cents | null;
  saldoEm: IsoDate | null;
  resultado: Cents | null;
  tarefasPendentes: number;
  ultimaAtividade: IsoDate | null;
};

export type TransactionRow = {
  id: string;
  data: IsoDate;
  projetoSlug: string;
  projetoNome: string;
  contaLabel: string;
  tipo: TransactionType;
  valor: Cents;
  descricao: string | null;
  /** Snapshot de saldo entra no histórico mas não soma no caixa. */
  isSnapshot?: boolean;
};

export type GoalRow = {
  id: string;
  titulo: string;
  metrica: GoalMetric;
  alvo: Cents;
  atual: Cents;
  contaLabel: string | null;
  prazo: IsoDate | null;
  concluidaEm: IsoDate | null;
};

export type AirdropClaimRow = {
  id: string;
  contaLabel: string;
  recebidoEm: IsoDate;
  token: string;
  quantidade: string;
  precoUsd: string;
  valor: Cents;
};

export type ProjectDetail = ProjectSummary & {
  links: ProjectLinks;
  notas: string | null;
  contasDetalhe: ProjectAccountRow[];
  historico: TransactionRow[];
  metas: GoalRow[];
  recebimentos: AirdropClaimRow[];
};

// -------------------------------------------------------------------- tarefas

export type TaskUrgency = "atrasada" | "hoje" | "proxima";

export type TaskOccurrenceRow = {
  /** Id da ocorrência (o item do dia). */
  id: string;
  /** Id da tarefa que gerou a ocorrência — o que se edita ou exclui. */
  taskId: string;
  titulo: string;
  descricao: string | null;
  projetoSlug: string;
  projetoNome: string;
  contaLabel: string;
  vencimento: IsoDate;
  recorrencia: Recurrence;
  concluida: boolean;
  urgencia: TaskUrgency;
  /** Negativo = atrasada em N dias; 0 = hoje. */
  diasRestantes: number;
};

// --------------------------------------------------------------------- contas

export type AccountSummary = {
  id: string;
  label: string;
  endereco: string | null;
  email: string | null;
  ativa: boolean;
  projetos: number;
  aportado: Cents;
  exposicao: Cents;
  resultado: Cents;
  tarefasPendentes: number;
  ultimaAtividade: IsoDate | null;
};

// ------------------------------------------------------------------ histórico

export type TipoAtividade =
  | "deposito"
  | "retirada"
  | "trade"
  | "taxa"
  | "volume"
  | "saldo"
  | "recebimento"
  | "tarefa";

/**
 * Uma linha do histórico de atividade.
 *
 * Derivada dos próprios registros — não é uma tabela de auditoria. Mostra o que
 * foi feito (aportes, saldos, tarefas cumpridas), não quem editou o quê.
 */
export type AtividadeRow = {
  id: string;
  tipo: TipoAtividade;
  data: IsoDate;
  projetoSlug: string;
  projetoNome: string;
  contaLabel: string;
  titulo: string;
  detalhe: string | null;
  valor: Cents | null;
};
