CREATE TYPE "public"."direcao_sinal" AS ENUM('compra', 'venda');--> statement-breakpoint
CREATE TYPE "public"."status_sinal" AS ENUM('aberto', 'encerrado', 'cancelado');--> statement-breakpoint
CREATE TABLE "sinais_trade" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ativo" text NOT NULL,
	"direcao" "direcao_sinal" NOT NULL,
	"entrada" numeric NOT NULL,
	"entrada_ate" numeric,
	"stop" numeric NOT NULL,
	"alvos" numeric[] NOT NULL,
	"timeframe" text,
	"observacao" text,
	"status" "status_sinal" DEFAULT 'aberto' NOT NULL,
	"publicado_por" uuid,
	"publicado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"discord_enviado_em" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "sinais_trade" ADD CONSTRAINT "sinais_trade_publicado_por_users_id_fk" FOREIGN KEY ("publicado_por") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "sinais_publicado_idx" ON "sinais_trade" USING btree ("publicado_em");