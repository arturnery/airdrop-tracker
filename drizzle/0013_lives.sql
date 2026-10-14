CREATE TYPE "public"."recorrencia_live" AS ENUM('nenhuma', 'semanal', 'quinzenal');--> statement-breakpoint
CREATE TABLE "lives" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"titulo" text NOT NULL,
	"apresentador" text,
	"descricao" text,
	"link" text,
	"inicio_em" timestamp with time zone NOT NULL,
	"recorrencia" "recorrencia_live" DEFAULT 'nenhuma' NOT NULL,
	"repetir_ate" date,
	"destaque" boolean DEFAULT false NOT NULL,
	"criado_por" uuid,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "lives" ADD CONSTRAINT "lives_criado_por_users_id_fk" FOREIGN KEY ("criado_por") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "lives_inicio_idx" ON "lives" USING btree ("inicio_em");