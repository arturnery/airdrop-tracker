CREATE TYPE "public"."saida_sinal" AS ENUM('alvo1', 'alvo2', 'alvo3', 'alvo4', 'stop', 'manual');--> statement-breakpoint
ALTER TABLE "sinais_trade" ADD COLUMN "saida" "saida_sinal";--> statement-breakpoint
ALTER TABLE "sinais_trade" ADD COLUMN "preco_saida" numeric;--> statement-breakpoint
ALTER TABLE "sinais_trade" ADD COLUMN "encerrado_em" timestamp with time zone;