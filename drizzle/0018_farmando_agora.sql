ALTER TABLE "catalog_projects" ADD COLUMN "status" "project_status" DEFAULT 'ativo' NOT NULL;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "farmando" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "saida_do_farm_motivo" text;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "saida_do_farm_em" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "status_do_destaque_visto" "project_status";--> statement-breakpoint
-- O catálogo passa a carregar o status do projeto de quem publicou.
UPDATE "catalog_projects" c SET "status" = p."status" FROM "projects" p WHERE p."id" = c."source_project_id";--> statement-breakpoint
-- Estreia: entra em "Farmando agora" só o que a pessoa já tinha escolhido dos destaques (adotado) e o
-- projeto que o próprio admin destacou, desde que ativo. O resto, cada um escolhe.
UPDATE "projects" SET "farmando" = true WHERE "status" IN ('ativo', 'tge_anunciado') AND ("adopted_from_id" IS NOT NULL OR "id" IN (SELECT "source_project_id" FROM "catalog_projects" WHERE "published_at" IS NOT NULL AND "source_project_id" IS NOT NULL));--> statement-breakpoint
-- Ninguém estreia com aviso de mudança: o status atual do destaque conta como já visto.
UPDATE "projects" p SET "status_do_destaque_visto" = c."status" FROM "catalog_projects" c WHERE c."id" = p."adopted_from_id";
