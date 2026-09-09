ALTER TABLE "projects" ALTER COLUMN "priority" SET DEFAULT 2;--> statement-breakpoint
ALTER TABLE "catalog_projects" ADD COLUMN "priority" smallint DEFAULT 2 NOT NULL;