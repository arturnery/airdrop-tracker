CREATE TABLE "entradas_trade" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sinal_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"valor_usd" numeric(14, 2) NOT NULL,
	"entrou_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "entradas_sinal_usuario_unq" UNIQUE("sinal_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "entradas_trade" ADD CONSTRAINT "entradas_trade_sinal_id_sinais_trade_id_fk" FOREIGN KEY ("sinal_id") REFERENCES "public"."sinais_trade"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entradas_trade" ADD CONSTRAINT "entradas_trade_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;