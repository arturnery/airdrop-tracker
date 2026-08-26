CREATE TABLE "volume_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	"taken_at" date NOT NULL,
	"volume_usd" numeric(18, 2) NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "volume_pair_day_unq" UNIQUE("project_id","account_id","taken_at")
);
--> statement-breakpoint
ALTER TABLE "volume_snapshots" ADD CONSTRAINT "volume_snapshots_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "volume_snapshots" ADD CONSTRAINT "volume_project_account_fk" FOREIGN KEY ("project_id","account_id") REFERENCES "public"."project_accounts"("project_id","account_id") ON DELETE cascade ON UPDATE no action;