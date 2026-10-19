ALTER TABLE "buyer_workspaces" ADD COLUMN IF NOT EXISTS "chat_history" jsonb NOT NULL DEFAULT '[]'::jsonb;
