CREATE TABLE "buyer_workspaces" (
	"user_id" integer PRIMARY KEY NOT NULL,
	"saved_property_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"general_notes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"property_notes" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"destinations" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_sessions" (
	"token_hash" char(64) PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "buyer_workspaces" ADD CONSTRAINT "buyer_workspaces_user_id_users_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_sessions" ADD CONSTRAINT "user_sessions_user_id_users_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_user_sessions_user" ON "user_sessions" USING btree ("user_id");