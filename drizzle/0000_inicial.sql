CREATE TYPE "public"."goal_metric" AS ENUM('volume_usd', 'balance_usd', 'tx_count', 'days_active');--> statement-breakpoint
CREATE TYPE "public"."import_status" AS ENUM('concluida', 'revertida');--> statement-breakpoint
CREATE TYPE "public"."project_account_status" AS ENUM('ativa', 'pausada', 'queimada');--> statement-breakpoint
CREATE TYPE "public"."project_category" AS ENUM('liquidez', 'interacoes', 'perps');--> statement-breakpoint
CREATE TYPE "public"."project_status" AS ENUM('pesquisando', 'ativo', 'pausado', 'tge_anunciado', 'distribuido', 'descartado');--> statement-breakpoint
CREATE TYPE "public"."recurrence" AS ENUM('none', 'daily', 'weekly', 'monthly', 'every_n_days');--> statement-breakpoint
CREATE TYPE "public"."transaction_type" AS ENUM('deposit', 'withdrawal', 'trade_pnl', 'yield', 'fee_gas', 'volume_traded', 'other');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('admin', 'membro');--> statement-breakpoint
CREATE TYPE "public"."user_status" AS ENUM('pendente', 'aprovado', 'recusado');--> statement-breakpoint
CREATE TABLE "accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"label" text NOT NULL,
	"wallet_address" text,
	"email" text,
	"notes" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "accounts_user_label_unq" UNIQUE("user_id","label")
);
--> statement-breakpoint
CREATE TABLE "airdrop_claims" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	"received_at" date NOT NULL,
	"token_symbol" text NOT NULL,
	"token_amount" numeric(36, 18) NOT NULL,
	"price_usd" numeric(18, 8) NOT NULL,
	"value_usd" numeric(18, 2) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "goal_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"goal_id" uuid NOT NULL,
	"occurred_at" date NOT NULL,
	"value" numeric(18, 2) NOT NULL,
	"note" text
);
--> statement-breakpoint
CREATE TABLE "goals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"account_id" uuid,
	"title" text NOT NULL,
	"metric" "goal_metric" NOT NULL,
	"target_value" numeric(18, 2) NOT NULL,
	"deadline" date,
	"achieved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "import_batches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"filename" text NOT NULL,
	"imported_at" timestamp with time zone DEFAULT now() NOT NULL,
	"row_count" integer DEFAULT 0 NOT NULL,
	"created_projects" integer DEFAULT 0 NOT NULL,
	"created_accounts" integer DEFAULT 0 NOT NULL,
	"status" "import_status" DEFAULT 'concluida' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "points_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	"taken_at" date NOT NULL,
	"points" numeric(24, 4) NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "points_pair_day_unq" UNIQUE("project_id","account_id","taken_at")
);
--> statement-breakpoint
CREATE TABLE "profile_settings" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"is_shared" boolean DEFAULT false NOT NULL,
	"show_projects" boolean DEFAULT true NOT NULL,
	"show_tasks" boolean DEFAULT true NOT NULL,
	"show_values" boolean DEFAULT false NOT NULL,
	"show_accounts" boolean DEFAULT false NOT NULL,
	"show_wallets" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_accounts" (
	"project_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	"status" "project_account_status" DEFAULT 'ativa' NOT NULL,
	"started_at" date NOT NULL,
	"notes" text,
	CONSTRAINT "project_accounts_project_id_account_id_pk" PRIMARY KEY("project_id","account_id")
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"status" "project_status" DEFAULT 'ativo' NOT NULL,
	"category" "project_category",
	"points_label" text,
	"chain" text,
	"priority" smallint DEFAULT 3 NOT NULL,
	"website_url" text,
	"discord_url" text,
	"twitter_url" text,
	"docs_url" text,
	"expected_tge_date" date,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone,
	CONSTRAINT "projects_user_slug_unq" UNIQUE("user_id","slug"),
	CONSTRAINT "projects_user_name_unq" UNIQUE("user_id","name")
);
--> statement-breakpoint
CREATE TABLE "task_occurrences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	"due_date" date NOT NULL,
	"completed_at" timestamp with time zone,
	"skipped" boolean DEFAULT false NOT NULL,
	CONSTRAINT "occurrences_task_account_date_unq" UNIQUE("task_id","account_id","due_date")
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"account_id" uuid,
	"title" text NOT NULL,
	"description" text,
	"recurrence" "recurrence" DEFAULT 'none' NOT NULL,
	"interval_days" smallint,
	"due_date" date,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "token_prices" (
	"user_id" uuid NOT NULL,
	"symbol" text NOT NULL,
	"price_usd" numeric(18, 8) NOT NULL,
	"updated_at" date NOT NULL,
	CONSTRAINT "token_prices_user_id_symbol_pk" PRIMARY KEY("user_id","symbol")
);
--> statement-breakpoint
CREATE TABLE "transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	"occurred_at" date NOT NULL,
	"type" "transaction_type" NOT NULL,
	"amount_usd" numeric(18, 2) NOT NULL,
	"token_symbol" text,
	"token_amount" numeric(36, 18),
	"description" text,
	"import_batch_id" uuid,
	"dedupe_key" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "transactions_user_dedupe_unq" UNIQUE("user_id","dedupe_key")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"handle" text,
	"display_name" text,
	"password_hash" text,
	"role" "user_role" DEFAULT 'membro' NOT NULL,
	"status" "user_status" DEFAULT 'pendente' NOT NULL,
	"reviewed_at" timestamp with time zone,
	"review_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_handle_unique" UNIQUE("handle")
);
--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "airdrop_claims" ADD CONSTRAINT "airdrop_claims_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "airdrop_claims" ADD CONSTRAINT "claims_project_account_fk" FOREIGN KEY ("project_id","account_id") REFERENCES "public"."project_accounts"("project_id","account_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goal_entries" ADD CONSTRAINT "goal_entries_goal_id_goals_id_fk" FOREIGN KEY ("goal_id") REFERENCES "public"."goals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goals" ADD CONSTRAINT "goals_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goals" ADD CONSTRAINT "goals_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goals" ADD CONSTRAINT "goals_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_batches" ADD CONSTRAINT "import_batches_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "points_snapshots" ADD CONSTRAINT "points_snapshots_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "points_snapshots" ADD CONSTRAINT "points_project_account_fk" FOREIGN KEY ("project_id","account_id") REFERENCES "public"."project_accounts"("project_id","account_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profile_settings" ADD CONSTRAINT "profile_settings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_accounts" ADD CONSTRAINT "project_accounts_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_accounts" ADD CONSTRAINT "project_accounts_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_occurrences" ADD CONSTRAINT "task_occurrences_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_occurrences" ADD CONSTRAINT "task_occurrences_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "token_prices" ADD CONSTRAINT "token_prices_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_project_account_fk" FOREIGN KEY ("project_id","account_id") REFERENCES "public"."project_accounts"("project_id","account_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "transactions_user_project_date_idx" ON "transactions" USING btree ("user_id","project_id","occurred_at");