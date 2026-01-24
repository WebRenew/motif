-- Add status column to animation_captures for async job tracking
-- Supports the background capture pattern with Vercel after()

-- Create enum type for capture status
DO $$ BEGIN
    CREATE TYPE capture_status AS ENUM ('pending', 'processing', 'completed', 'failed');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Add status column with default 'pending'
ALTER TABLE "public"."animation_captures"
ADD COLUMN IF NOT EXISTS "status" capture_status DEFAULT 'pending' NOT NULL;

-- Add error_message column for failed captures
ALTER TABLE "public"."animation_captures"
ADD COLUMN IF NOT EXISTS "error_message" text;

-- Index for polling queries (status + created_at for efficient lookups)
CREATE INDEX IF NOT EXISTS "idx_animation_captures_status"
ON "public"."animation_captures" USING "btree" ("status");

-- Comments
COMMENT ON COLUMN "public"."animation_captures"."status" IS 'Job status: pending, processing, completed, failed';
COMMENT ON COLUMN "public"."animation_captures"."error_message" IS 'Error message if capture failed';
