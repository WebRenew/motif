-- Fix: ON CONFLICT requires a UNIQUE CONSTRAINT, not just a partial unique INDEX
-- PostgreSQL treats NULLs as distinct, so this constraint only enforces uniqueness
-- when all three columns are NOT NULL (which is exactly what we want)

-- Drop the partial index (it's redundant with the constraint)
DROP INDEX IF EXISTS "public"."idx_animation_captures_workflow_node_upsert";

-- Add a proper unique constraint for upsert support
ALTER TABLE "public"."animation_captures"
ADD CONSTRAINT "animation_captures_user_workflow_node_unique"
UNIQUE ("user_id", "workflow_id", "node_id");
