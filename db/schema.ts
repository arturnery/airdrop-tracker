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

// ---------------------------------------------------------------- tabelas

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
