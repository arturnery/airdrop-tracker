CREATE TABLE "ia_usos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ia_usos" ADD CONSTRAINT "ia_usos_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ia_usos_usuario_idx" ON "ia_usos" USING btree ("user_id","criado_em");--> statement-breakpoint
CREATE INDEX "ia_usos_criado_idx" ON "ia_usos" USING btree ("criado_em");