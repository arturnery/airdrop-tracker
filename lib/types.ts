import type { Cents } from "./money";
import type { Points } from "./points";

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
  | "yield"
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

/** Datas trafegam como "YYYY-MM-DD": sem timezone, ver ARCHITECTURE.md §5. */
export type IsoDate = string;

// ------------------------------------------------------------------ dashboard

export type FinancialSummary = {
  /** Total já depositado na história. Base do ROI, não vai para a tela. */
  aportado: Cents;
  /** O que está depositado agora: depósitos menos retiradas. Vai para a tela. */
  capitalDepositado: Cents;
  retirado: Cents;
  taxas: Cents;
  pnlTrades: Cents;
  rendimentos: Cents;
  airdrops: Cents;
  exposicao: Cents;
  resultado: Cents;
  /** null quando não há aporte: evita divisão por zero virar Infinity na tela. */
  roi: number | null;
};

export type DashboardSummary = FinancialSummary & {
  projetosAtivos: number;
  projetosTotal: number;
  contasAtivas: number;
  tarefasHoje: number;
  tarefasAtrasadas: number;
  /** Símbolos sem cotação informada: a interface pede a atualização. */
  tokensSemCotacao: string[];
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
  capitalDepositado: Cents;
  /**
   * Soma dos lançamentos de volume operado. Fica fora do caixa (é atividade,
   * não dinheiro movimentado), e por isso vive num campo próprio.
   */
  volumeOperado: Cents;
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
  /** Soma de tudo que foi lançado nesta conta, com token revalorizado. */
  saldo: Cents;
  resultado: Cents;
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
  /** Preenchidos quando o lançamento foi em token. */
  tokenSymbol: string | null;
  tokenAmount: string | null;
};

/** Posição em token de um projeto, revalorizada pela cotação atual. */
export type TokenPositionRow = {
  symbol: string;
  quantidade: number;
  investidoUsd: Cents;
  /** Investido ÷ quantidade: o preço que você pagou, em média. */
  precoMedioUsd: Cents | null;
  valorAtualUsd: Cents;
  /** null quando não há cotação informada. */
  precoUsd: Cents | null;
  valorizacao: Cents | null;
  valorizacaoPercent: number | null;
};

export type TokenPriceRow2 = {
  symbol: string;
  precoUsd: Cents;
  atualizadoEm: IsoDate;
  /** Em quantos projetos esse token aparece. */
  usadoEm: number;
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
  posicoesToken: TokenPositionRow[];
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
  /** Id da tarefa que gerou a ocorrência: o que se edita ou exclui. */
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
  | "rendimento"
  | "taxa"
  | "volume"
  | "recebimento"
  | "tarefa";

/**
 * Uma linha do histórico de atividade.
 *
 * Derivada dos próprios registros: não é uma tabela de auditoria. Mostra o que
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

// --------------------------------------------------------------------- pontos

/** Uma conta dentro de um programa de pontos. */
export type PointsAccountRow = {
  contaId: string;
  label: string;
  /** null quando a conta nunca teve registro de pontos. */
  total: Points | null;
  atualizadoEm: IsoDate | null;
  /** Variação desde o registro anterior desta conta. */
  variacao: Points | null;
  desdeEm: IsoDate | null;
  nota: string | null;
};

/**
 * Programa de pontos de um projeto.
 *
 * O total só faz sentido dentro do projeto: pontos de programas diferentes são
 * unidades diferentes e nunca são somados entre si.
 */
export type PointsProgramRow = {
  projetoId: string;
  projetoSlug: string;
  projetoNome: string;
  /** Nome do programa: "Pontos", "XP", "Marks". */
  rotulo: string;
  total: Points;
  /** Total na medição anterior, para comparar. */
  totalAnterior: Points | null;
  variacao: Points | null;
  crescimento: number | null;
  atualizadoEm: IsoDate | null;
  contas: PointsAccountRow[];
};

export type PointsSnapshotRow = {
  id: string;
  data: IsoDate;
  contaId: string;
  contaLabel: string;
  total: Points;
  variacao: Points | null;
  nota: string | null;
};

// -------------------------------------------------------------------- membros

export type MemberStatus = "pendente" | "aprovado" | "recusado";

export type MemberRow = {
  id: string;
  nome: string;
  email: string;
  status: MemberStatus;
  cadastradoEm: IsoDate;
  revisadoEm: IsoDate | null;
  nota: string | null;
  /** Dias desde o cadastro: quem espera há mais tempo aparece primeiro. */
  diasEsperando: number;
};

export type MembersSummary = {
  pendentes: number;
  aprovados: number;
  recusados: number;
  /** Maior espera entre os pendentes, para dimensionar o atraso. */
  esperaMaisLonga: number | null;
};
