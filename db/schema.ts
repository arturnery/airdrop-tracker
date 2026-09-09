import { relations } from "drizzle-orm";
import {
  type AnyPgColumn,
  boolean,
  date,
  foreignKey,
  index,
  integer,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

/**
 * Schema do banco. Ver ARCHITECTURE.md §4 para o modelo e o porquê de cada
 * decisão. Os pontos que mais importam:
 *
 *  - **Dinheiro é `numeric`, nunca float** (§5). O Drizzle devolve `numeric`
 *    como string e `lib/money.ts` converte para centavos inteiros.
 *  - **Datas de evento são `date`, sem timezone** (§5). Um depósito de 25/06 é
 *    25/06 independentemente do fuso do servidor. Só instantes de sistema
 *    (`created_at`, `completed_at`) usam `timestamptz`.
 *  - **Movimento pendura no par projeto×conta**, via FK composta (§4.3-B), e
 *    não em `projects` e `accounts` soltos.
 *  - **`user_id` em toda tabela raiz** desde a primeira migração (§9.1).
 */

// ------------------------------------------------------------------- enums

export const userRoleEnum = pgEnum("user_role", ["admin", "membro"]);

export const userStatusEnum = pgEnum("user_status", [
  "pendente",
  "aprovado",
  "recusado",
]);

export const projectStatusEnum = pgEnum("project_status", [
  "pesquisando",
  "ativo",
  "pausado",
  "tge_anunciado",
  "distribuido",
  "descartado",
]);

/** Como o projeto é farmado: define a rotina de trabalho. */
export const projectCategoryEnum = pgEnum("project_category", [
  "liquidez",
  "interacoes",
  "perps",
]);

export const projectAccountStatusEnum = pgEnum("project_account_status", [
  "ativa",
  "pausada",
  "queimada",
]);

/**
 * `volume_traded` registra atividade, não caixa: fica FORA do saldo (§5).
 * `fee_gas` sai do bolso, não da posição, então também não entra no saldo:
 * mas é descontado do resultado.
 */
export const transactionTypeEnum = pgEnum("transaction_type", [
  "deposit",
  "withdrawal",
  "trade_pnl",
  "yield",
  "fee_gas",
  "volume_traded",
  "other",
]);

export const recurrenceEnum = pgEnum("recurrence", [
  "none",
  "daily",
  "weekly",
  "monthly",
  "every_n_days",
]);

export const goalMetricEnum = pgEnum("goal_metric", [
  "volume_usd",
  "balance_usd",
  "tx_count",
  "days_active",
]);

export const importStatusEnum = pgEnum("import_status", [
  "concluida",
  "revertida",
]);

// ------------------------------------------------------------------ usuários

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  /** Usado na URL do perfil compartilhado: /u/artur. */
  handle: text("handle").unique(),
  displayName: text("display_name"),
  /**
   * Hash da senha: nunca a senha. Nulo enquanto não definida: a conta semeada
   * por `npm run db:seed` existe antes de ter senha.
   */
  passwordHash: text("password_hash"),
  role: userRoleEnum("role").notNull().default("membro"),
  status: userStatusEnum("status").notNull().default("pendente"),
  /**
   * Conta de demonstração, com senha publicada no README.
   *
   * É uma coluna e não um valor de `role` porque não substitui o papel: a conta
   * demo continua sendo `membro` para todo efeito de autorização, e virar um
   * terceiro papel obrigaria a revisar cada comparação de `role` no sistema.
   *
   * O que a marca muda é pontual: nome e senha ficam travados. Sem isso, a
   * primeira pessoa a entrar poderia trocar a senha e trancar todas as
   * seguintes do lado de fora, ou renomear a conta para algo que o próximo
   * visitante veria na barra lateral.
   */
  isDemo: boolean("is_demo").notNull().default(false),
  /**
   * Senha temporária entregue por quem administra: o acesso fica restrito à
   * troca de senha até a pessoa definir a dela.
   *
   * A restrição é verificada no servidor, a cada requisição. Esconder as telas
   * não bastaria: as Server Actions continuariam alcançáveis, e é justamente
   * quem entrou com uma senha que não escolheu que não deve poder agir.
   */
  mustChangePassword: boolean("must_change_password").notNull().default(false),
  /**
   * Última vez que as ocorrências recorrentes foram materializadas.
   *
   * O motor roda na leitura (§6), e sem esta marca ele refazia o cálculo a cada
   * navegação: cinco consultas para concluir, quase sempre, que não havia nada
   * a criar. Ler uma tela não deveria custar isso.
   *
   * Fica em `users` e não numa tabela própria porque é um dado por pessoa, lido
   * junto do resto e escrito raramente.
   */
  ocorrenciasEm: timestamp("ocorrencias_em", { withTimezone: true }),
  /**
   * Última versão do changelog que a pessoa já viu, para o sino de novidades.
   *
   * Guarda a versão (`"1.8"`), não uma data: comparar com `versaoAtual` de
   * `lib/changelog` é uma comparação de string, sem depender de quando cada
   * uma foi publicada. Nulo enquanto a pessoa nunca abriu `/novidades`, e
   * nesse estado qualquer versão já conta como não vista.
   */
  novidadesVistasVersao: text("novidades_vistas_versao"),
  /** Quando o acesso foi liberado ou recusado; nulo enquanto pendente. */
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  /** Por que foi recusado. Visível só para quem administra. */
  reviewNote: text("review_note"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/** O que o perfil mostra para outros membros. Ver §9.2. */
export const profileSettings = pgTable("profile_settings", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  isShared: boolean("is_shared").notNull().default(false),
  showProjects: boolean("show_projects").notNull().default(true),
  showTasks: boolean("show_tasks").notNull().default(true),
  showValues: boolean("show_values").notNull().default(false),
  showAccounts: boolean("show_accounts").notNull().default(false),
  /** Endereço 0x…: nasce desligado; ver o aviso em §9.2. */
  showWallets: boolean("show_wallets").notNull().default(false),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// -------------------------------------------------------------------- contas

/** Carteira ou perfil de navegador. Entidade global do usuário (§2.1). */
export const accounts = pgTable(
  "accounts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    label: text("label").notNull(),
    walletAddress: text("wallet_address"),
    email: text("email"),
    notes: text("notes"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [unique("accounts_user_label_unq").on(t.userId, t.label)],
);

// ------------------------------------------------------------------ projetos

export const projects = pgTable(
  "projects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    status: projectStatusEnum("status").notNull().default("ativo"),
    category: projectCategoryEnum("category"),
    /** Nome do programa de pontos ("Pontos", "XP"); nulo = não tem (§4.4). */
    pointsLabel: text("points_label"),
    chain: text("chain"),
    priority: smallint("priority").notNull().default(3),
    websiteUrl: text("website_url"),
    discordUrl: text("discord_url"),
    twitterUrl: text("twitter_url"),
    docsUrl: text("docs_url"),
    expectedTgeDate: date("expected_tge_date"),
    notes: text("notes"),
    /**
     * De qual entrada do catálogo da comunidade este projeto veio, quando veio
     * de lá. `null` é o caso comum: a grande maioria continua cadastrada à
     * mão. `ON DELETE SET NULL` porque apagar a entrada do catálogo não deve
     * apagar o projeto de quem já adotou (§13.3 do ARCHITECTURE): o projeto
     * adotado é da pessoa, indistinguível de um criado à mão.
     */
    adoptedFromId: uuid("adopted_from_id").references(
      (): AnyPgColumn => catalogProjects.id,
      { onDelete: "set null" },
    ),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
  },
  (t) => [
    unique("projects_user_slug_unq").on(t.userId, t.slug),
    // Necessário para o upsert do importador de planilha (§7.1).
    unique("projects_user_name_unq").on(t.userId, t.name),
    // Impede adotar a mesma entrada do catálogo duas vezes. NULL não conta
    // como duplicata para o Postgres, então quem nunca adotou nada não é
    // afetado por esta regra.
    unique("projects_user_adopted_unq").on(t.userId, t.adoptedFromId),
  ],
);

/**
 * Catálogo de projetos da comunidade (ARCHITECTURE §13).
 *
 * Entrada **independente** da linha em `projects` que a originou: ao publicar,
 * os campos editoriais são copiados para cá, e ao adotar, são copiados de cá
 * para um projeto novo. Nenhuma leitura de tela atravessa essa fronteira, e é
 * essa independência que elimina o risco de uma ação de quem administra
 * alcançar dado financeiro de outra pessoa (§13.5): a tabela não tem status,
 * aporte, tarefa nem anotação nenhuma, só o que é igual para todo mundo.
 *
 * `sourceProjectId` é o caminho de volta até o projeto de quem publicou, usado
 * só para saber se um projeto já está destacado e para recopiar os campos
 * quando a pessoa atualiza. `ON DELETE SET NULL`: apagar o projeto de origem
 * não apaga a entrada já publicada, ela só perde a lupa para os dados
 * originais e passa a valer pelo que já foi copiado.
 *
 * `publishedAt` nulo é o estado "fora do catálogo". Não existe um segundo
 * estado de rascunho como o desenho original previa: aqui a entrada nasce
 * junto do clique em "Destacar", então rascunho e publicado seriam o mesmo
 * instante.
 */
export const catalogProjects = pgTable(
  "catalog_projects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    category: projectCategoryEnum("category"),
    pointsLabel: text("points_label"),
    chain: text("chain"),
    websiteUrl: text("website_url"),
    discordUrl: text("discord_url"),
    twitterUrl: text("twitter_url"),
    docsUrl: text("docs_url"),
    expectedTgeDate: date("expected_tge_date"),
    /** Texto para a comunidade, escrito por quem publica. Distinto de `notes`,
     *  que é pessoal e nunca sai da conta de quem escreveu. */
    summary: text("summary"),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    sourceProjectId: uuid("source_project_id").references(
      (): AnyPgColumn => projects.id,
      { onDelete: "set null" },
    ),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    // Um projeto só pode estar destacado uma vez. NULL (entrada sem projeto de
    // origem) não conta como duplicata.
    unique("catalog_source_project_unq").on(t.sourceProjectId),
  ],
);

/**
 * Junção projeto × conta, com dados próprios.
 *
 * A chave composta é alvo das FKs das tabelas de movimento (§4.3-B): é ela que
 * impede registrar dinheiro numa conta nunca vinculada àquele projeto.
 */
export const projectAccounts = pgTable(
  "project_accounts",
  {
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    status: projectAccountStatusEnum("status").notNull().default("ativa"),
    startedAt: date("started_at").notNull(),
    notes: text("notes"),
  },
  (t) => [primaryKey({ columns: [t.projectId, t.accountId] })],
);

// --------------------------------------------------------------- lançamentos

/**
 * Livro-razão. O saldo de um par projeto×conta é a soma dos lançamentos:
 * não existe registro de saldo em separado (§2.2).
 */
export const transactions = pgTable(
  "transactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    projectId: uuid("project_id").notNull(),
    accountId: uuid("account_id").notNull(),
    occurredAt: date("occurred_at").notNull(),
    type: transactionTypeEnum("type").notNull(),
    /** Valor em dólar na data. Negativo em perda, retirada e taxa. */
    amountUsd: numeric("amount_usd", { precision: 18, scale: 2 }).notNull(),
    /** Preenchidos quando o aporte foi em token; a posição é revalorizada. */
    tokenSymbol: text("token_symbol"),
    tokenAmount: numeric("token_amount", { precision: 36, scale: 18 }),
    description: text("description"),
    importBatchId: uuid("import_batch_id"),
    /** Idempotência da importação: reimportar o mesmo arquivo não duplica. */
    dedupeKey: text("dedupe_key"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    foreignKey({
      columns: [t.projectId, t.accountId],
      foreignColumns: [projectAccounts.projectId, projectAccounts.accountId],
      name: "transactions_project_account_fk",
    }).onDelete("cascade"),
    index("transactions_user_project_date_idx").on(
      t.userId,
      t.projectId,
      t.occurredAt,
    ),
    unique("transactions_user_dedupe_unq").on(t.userId, t.dedupeKey),
  ],
);

/**
 * Cotação informada manualmente (§4.4).
 *
 * Sem API externa por decisão de projeto. Um símbolo por usuário: reinformar
 * substitui o preço anterior.
 */
export const tokenPrices = pgTable(
  "token_prices",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    symbol: text("symbol").notNull(),
    priceUsd: numeric("price_usd", { precision: 18, scale: 8 }).notNull(),
    updatedAt: date("updated_at").notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.symbol] })],
);

// -------------------------------------------------------------------- pontos

/**
 * Foto do acumulado de pontos. Programas exibem total, não extrato: o ganho
 * do período sai da diferença entre duas medições (§4.4).
 */
export const pointsSnapshots = pgTable(
  "points_snapshots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    projectId: uuid("project_id").notNull(),
    accountId: uuid("account_id").notNull(),
    takenAt: date("taken_at").notNull(),
    points: numeric("points", { precision: 24, scale: 4 }).notNull(),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    foreignKey({
      columns: [t.projectId, t.accountId],
      foreignColumns: [projectAccounts.projectId, projectAccounts.accountId],
      name: "points_project_account_fk",
    }).onDelete("cascade"),
    // Uma medição por par por dia: reinformar corrige em vez de duplicar.
    unique("points_pair_day_unq").on(t.projectId, t.accountId, t.takenAt),
  ],
);

// ------------------------------------------------------------------- tarefas

export const tasks = pgTable("tasks", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  /** Nulo = a tarefa vale para todas as contas do projeto. */
  accountId: uuid("account_id").references(() => accounts.id, {
    onDelete: "cascade",
  }),
  title: text("title").notNull(),
  description: text("description"),
  recurrence: recurrenceEnum("recurrence").notNull().default("none"),
  intervalDays: smallint("interval_days"),
  dueDate: date("due_date"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/**
 * Ocorrências materializadas.
 *
 * A constraint única garante idempotência do motor de recorrência (§6): o
 * `INSERT ... ON CONFLICT DO NOTHING` pode rodar quantas vezes for.
 */
export const taskOccurrences = pgTable(
  "task_occurrences",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    taskId: uuid("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    dueDate: date("due_date").notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    skipped: boolean("skipped").notNull().default(false),
  },
  (t) => [
    unique("occurrences_task_account_date_unq").on(
      t.taskId,
      t.accountId,
      t.dueDate,
    ),
  ],
);

// --------------------------------------------------------------------- metas

export const goals = pgTable("goals", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  accountId: uuid("account_id").references(() => accounts.id, {
    onDelete: "cascade",
  }),
  title: text("title").notNull(),
  metric: goalMetricEnum("metric").notNull(),
  targetValue: numeric("target_value", { precision: 18, scale: 2 }).notNull(),
  deadline: date("deadline"),
  achievedAt: timestamp("achieved_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/**
 * Progresso manual de meta.
 *
 * Só para métricas que não se derivam de outra tabela (§4.3-C). `current_value`
 * não existe como coluna: valor calculado guardado diverge quando um registro
 * antigo é editado.
 */
export const goalEntries = pgTable("goal_entries", {
  id: uuid("id").primaryKey().defaultRandom(),
  goalId: uuid("goal_id")
    .notNull()
    .references(() => goals.id, { onDelete: "cascade" }),
  occurredAt: date("occurred_at").notNull(),
  value: numeric("value", { precision: 18, scale: 2 }).notNull(),
  note: text("note"),
});

/**
 * Medição de volume operado acumulado.
 *
 * Mesma natureza dos pontos, e pelo mesmo motivo: a plataforma mostra um
 * **acumulado**, não um extrato. Quem lançava incrementos precisava calcular de
 * cabeça quanto tinha rodado desde a última vez, e um lançamento esquecido
 * sumia do total sem deixar rastro. Aqui se registra o número que está na tela
 * da corretora, e o ganho do período sai da diferença entre duas medições.
 *
 * É foto, e não fluxo: por isso tabela separada de `transactions`, que é a
 * distinção que sustenta o modelo inteiro (§2).
 *
 * Volume continua fora do saldo e do resultado. Ele mede atividade para
 * critério de elegibilidade, e somá-lo ao dinheiro inflaria o capital.
 */
export const volumeSnapshots = pgTable(
  "volume_snapshots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    projectId: uuid("project_id").notNull(),
    accountId: uuid("account_id").notNull(),
    takenAt: date("taken_at").notNull(),
    volumeUsd: numeric("volume_usd", { precision: 18, scale: 2 }).notNull(),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    foreignKey({
      columns: [t.projectId, t.accountId],
      foreignColumns: [projectAccounts.projectId, projectAccounts.accountId],
      name: "volume_project_account_fk",
    }).onDelete("cascade"),
    // Uma medição por par por dia: reinformar corrige em vez de duplicar.
    unique("volume_pair_day_unq").on(t.projectId, t.accountId, t.takenAt),
  ],
);

// --------------------------------------------------------------- recebimentos

export const airdropClaims = pgTable(
  "airdrop_claims",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    projectId: uuid("project_id").notNull(),
    accountId: uuid("account_id").notNull(),
    receivedAt: date("received_at").notNull(),
    tokenSymbol: text("token_symbol").notNull(),
    /*
     * Quantidade e preço são opcionais, e o valor em dólar não.
     *
     * Quem sabe quanto recebeu e a que preço informa os dois, e o valor sai da
     * multiplicação. Quem só sabe que "deu uns $75" informa o total direto. O
     * segundo caso é comum quando o token já foi vendido, ou quando o valor
     * veio de um resumo da corretora: exigir a decomposição obrigaria a
     * inventar um dos dois números, e um número inventado no banco é pior do
     * que um campo vazio.
     *
     * `value_usd` continua obrigatório porque é o que entra no resultado.
     * Nenhuma soma depende de quantidade ou preço.
     */
    tokenAmount: numeric("token_amount", { precision: 36, scale: 18 }),
    priceUsd: numeric("price_usd", { precision: 18, scale: 8 }),
    /** Congelado no registro: o preço muda depois, o histórico não. */
    valueUsd: numeric("value_usd", { precision: 18, scale: 2 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    foreignKey({
      columns: [t.projectId, t.accountId],
      foreignColumns: [projectAccounts.projectId, projectAccounts.accountId],
      name: "claims_project_account_fk",
    }).onDelete("cascade"),
  ],
);

// ---------------------------------------------------------------- importação

/** Rastro de cada importação, para desfazer o lote sem tocar no resto (§7.3). */
export const importBatches = pgTable("import_batches", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  filename: text("filename").notNull(),
  importedAt: timestamp("imported_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  rowCount: integer("row_count").notNull().default(0),
  createdProjects: integer("created_projects").notNull().default(0),
  createdAccounts: integer("created_accounts").notNull().default(0),
  status: importStatusEnum("status").notNull().default("concluida"),
});

// ------------------------------------------------------------------ relações

export const usersRelations = relations(users, ({ many, one }) => ({
  accounts: many(accounts),
  projects: many(projects),
  transactions: many(transactions),
  settings: one(profileSettings),
}));

export const projectsRelations = relations(projects, ({ one, many }) => ({
  user: one(users, { fields: [projects.userId], references: [users.id] }),
  contas: many(projectAccounts),
  transactions: many(transactions),
  tasks: many(tasks),
  goals: many(goals),
}));

export const accountsRelations = relations(accounts, ({ one, many }) => ({
  user: one(users, { fields: [accounts.userId], references: [users.id] }),
  projetos: many(projectAccounts),
}));

export const projectAccountsRelations = relations(projectAccounts, ({ one }) => ({
  project: one(projects, {
    fields: [projectAccounts.projectId],
    references: [projects.id],
  }),
  account: one(accounts, {
    fields: [projectAccounts.accountId],
    references: [accounts.id],
  }),
}));

export const tasksRelations = relations(tasks, ({ one, many }) => ({
  project: one(projects, { fields: [tasks.projectId], references: [projects.id] }),
  occurrences: many(taskOccurrences),
}));

export const taskOccurrencesRelations = relations(taskOccurrences, ({ one }) => ({
  task: one(tasks, { fields: [taskOccurrences.taskId], references: [tasks.id] }),
}));

export const goalsRelations = relations(goals, ({ one, many }) => ({
  project: one(projects, { fields: [goals.projectId], references: [projects.id] }),
  entries: many(goalEntries),
}));

// --------------------------------------------------------------------- tipos

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Account = typeof accounts.$inferSelect;
export type Project = typeof projects.$inferSelect;
export type ProjectAccount = typeof projectAccounts.$inferSelect;
export type Transaction = typeof transactions.$inferSelect;
export type NewTransaction = typeof transactions.$inferInsert;
export type TokenPrice = typeof tokenPrices.$inferSelect;
export type PointsSnapshot = typeof pointsSnapshots.$inferSelect;
export type Task = typeof tasks.$inferSelect;
export type TaskOccurrence = typeof taskOccurrences.$inferSelect;
export type Goal = typeof goals.$inferSelect;
export type AirdropClaim = typeof airdropClaims.$inferSelect;
export type ImportBatch = typeof importBatches.$inferSelect;
export type ProfileSettings = typeof profileSettings.$inferSelect;

/**
 * Pedidos de redefinição de senha.
 *
 * Não há envio automático de e-mail, e para uma comunidade fechada com
 * aprovação manual isso é infraestrutura que não se paga. O pedido vira uma
 * notificação na área de administração, e quem administra gera a senha
 * temporária.
 *
 * A linha só existe se a conta existir. A tela responde a mesma coisa nos dois
 * casos, então quem testa endereços alheios não descobre nada; a diferença fica
 * no banco, invisível para quem pediu.
 */
export const passwordResetRequests = pgTable(
  "password_reset_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    requestedAt: timestamp("requested_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    /** Quando quem administra gerou a senha. Nulo enquanto está na fila. */
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  },
  (t) => [index("reset_requests_user_idx").on(t.userId, t.requestedAt)],
);

export const feedbackTipoEnum = pgEnum("feedback_tipo", [
  "bug",
  "duvida",
  "sugestao",
]);

/**
 * Relatos de suporte e feedback. Ver ARCHITECTURE.md §14.
 *
 * O valor está nos três campos de contexto (`rota`, `versao`, `user_id`), não
 * na mensagem: relato que chega por fora vem sem eles, e descobrir em qual tela
 * e em qual versão algo quebrou custa mais idas e voltas que o próprio conserto.
 *
 * Não há tabela de respostas: a resposta sai por e-mail, que já está no
 * cadastro. Conversa registrada exigiria thread e estado, e seria a quarta fila
 * com o mesmo desenho das outras três.
 */
export const feedback = pgTable(
  "feedback",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tipo: feedbackTipoEnum("tipo").notNull(),
    mensagem: text("mensagem").notNull(),
    /** Tela de origem, capturada no envio: metade dos relatos se resolve com ela. */
    rota: text("rota"),
    /** Versão do changelog no momento do envio, para separar defeito já corrigido. */
    versao: text("versao"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    lidoEm: timestamp("lido_em", { withTimezone: true }),
    resolvidoEm: timestamp("resolvido_em", { withTimezone: true }),
  },
  (t) => [index("feedback_criado_idx").on(t.createdAt)],
);

/**
 * Tentativas de login que falharam. Ver a auditoria em ARCHITECTURE §16.3.
 *
 * Existe para limitar força bruta. Sem ela, uma senha fraca cai por tentativa
 * e erro: bcrypt com custo 12 torna cada tentativa cara (~250ms), o que atrasa
 * um ataque mas não o impede quando ele roda em paralelo por horas.
 *
 * Guarda o e-mail tentado, e não o usuário, de propósito: tentativa contra
 * conta inexistente também precisa ser contada, senão o tempo de resposta
 * passaria a distinguir e-mail cadastrado de não cadastrado, que é justamente o
 * que a recusa única evita.
 */
export const loginAttempts = pgTable(
  "login_attempts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull(),
    tentadoEm: timestamp("tentado_em", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("login_attempts_email_idx").on(t.email, t.tentadoEm)],
);
