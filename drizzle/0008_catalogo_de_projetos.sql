CREATE TABLE "catalog_projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"category" "project_category",
	"points_label" text,
	"chain" text,
	"website_url" text,
	"discord_url" text,
	"twitter_url" text,
	"docs_url" text,
	"expected_tge_date" date,
	"summary" text,
	"created_by" uuid NOT NULL,
	"source_project_id" uuid,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "catalog_projects_slug_unique" UNIQUE("slug"),
	CONSTRAINT "catalog_source_project_unq" UNIQUE("source_project_id")
);
--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "adopted_from_id" uuid;--> statement-breakpoint
ALTER TABLE "catalog_projects" ADD CONSTRAINT "catalog_projects_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catalog_projects" ADD CONSTRAINT "catalog_projects_source_project_id_projects_id_fk" FOREIGN KEY ("source_project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_adopted_from_id_catalog_projects_id_fk" FOREIGN KEY ("adopted_from_id") REFERENCES "public"."catalog_projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_user_adopted_unq" UNIQUE("user_id","adopted_from_id");