CREATE TYPE "public"."area_aviso" AS ENUM('airdrops');--> statement-breakpoint
CREATE TABLE "avisos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"area" "area_aviso" NOT NULL,
	"titulo" text NOT NULL,
	"resumo" text NOT NULL,
	"acao" text,
	"prazo" date,
	"link" text,
	"projeto" text,
	"perfil_x" text,
	"chamada_x" text,
	"publicado_por" uuid,
	"publicado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "avisos" ADD CONSTRAINT "avisos_publicado_por_users_id_fk" FOREIGN KEY ("publicado_por") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "avisos_area_publicado_idx" ON "avisos" USING btree ("area","publicado_em");