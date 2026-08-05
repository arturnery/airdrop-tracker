import { pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

/**
 * Schema do banco. Ver ARCHITECTURE.md §4 para o modelo completo.
 *
 * Fase 0 define apenas `users` e os enums do domínio — o suficiente para
 * validar a pipeline drizzle-kit ponta a ponta. As demais tabelas entram
 * na fase 1.
 */

// ---------------------------------------------------------------- enums

export const projectStatusEnum = pgEnum("project_status", [
  "pesquisando",
  "ativo",
  "pausado",
  "tge_anunciado",
  "distribuido",
  "descartado",
]);

export const projectAccountStatusEnum = pgEnum("project_account_status", [
  "ativa",
  "pausada",
  "queimada",
]);

/**
 * `volume_traded` registra atividade, não caixa: fica FORA do P&L (§5).
 * `fee_gas` está declarado desde já mesmo fora do MVP — custa zero e evita
 * uma migração de enum depois.
 */
export const transactionTypeEnum = pgEnum("transaction_type", [
  "deposit",
  "withdrawal",
  "trade_pnl",
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

/** Quem administra vê dados que os demais não veem — ver ARCHITECTURE.md §9.3. */
export const userRoleEnum = pgEnum("user_role", ["admin", "membro"]);

/** Cadastro livre com aprovação manual: nasce pendente. */
export const userStatusEnum = pgEnum("user_status", [
  "pendente",
  "aprovado",
  "recusado",
]);

// ---------------------------------------------------------------- tabelas

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  /**
   * Hash da senha — nunca a senha. Nulo enquanto a pessoa não definiu:
   * o administrador semeado por `npm run db:seed` existe antes de ter senha,
   * e a define no primeiro acesso.
   */
  passwordHash: text("password_hash"),
  role: userRoleEnum("role").notNull().default("membro"),
  status: userStatusEnum("status").notNull().default("pendente"),
  /** Quando o acesso foi liberado ou recusado; nulo enquanto pendente. */
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  /** Por que foi recusado. Visível só para quem administra. */
  reviewNote: text("review_note"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
