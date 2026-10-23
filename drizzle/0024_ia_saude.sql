CREATE TABLE "ia_saude" (
	"modelo" text PRIMARY KEY NOT NULL,
	"ultimo_ok" timestamp with time zone,
	"ultima_falha" timestamp with time zone,
	"tipo_falha" text,
	"detalhe_falha" text,
	"falhas_seguidas" integer DEFAULT 0 NOT NULL
);
