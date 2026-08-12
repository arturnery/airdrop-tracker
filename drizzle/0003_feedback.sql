CREATE TYPE "public"."feedback_tipo" AS ENUM('bug', 'duvida', 'sugestao');--> statement-breakpoint
CREATE TABLE "feedback" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"tipo" "feedback_tipo" NOT NULL,
	"mensagem" text NOT NULL,
	"rota" text,
	"versao" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"lido_em" timestamp with time zone,
	"resolvido_em" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "feedback_criado_idx" ON "feedback" USING btree ("created_at");