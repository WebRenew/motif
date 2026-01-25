-- Add workflow/node association to animation_captures for upsert support
-- This allows re-running a capture on the same node to update the existing record

-- Add workflow_id and node_id columns
ALTER TABLE "public"."animation_captures"
ADD COLUMN IF NOT EXISTS "workflow_id" "uuid" REFERENCES "public"."workflows"("id") ON DELETE SET NULL;

ALTER TABLE "public"."animation_captures"
ADD COLUMN IF NOT EXISTS "node_id" "uuid";

-- Create a unique constraint for upsert
-- When user_id + workflow_id + node_id match, we update instead of insert
CREATE UNIQUE INDEX IF NOT EXISTS "idx_animation_captures_workflow_node_upsert"
ON "public"."animation_captures" ("user_id", "workflow_id", "node_id")
WHERE "workflow_id" IS NOT NULL AND "node_id" IS NOT NULL;

-- Index for efficient lookups by workflow
CREATE INDEX IF NOT EXISTS "idx_animation_captures_workflow_id"
ON "public"."animation_captures" USING "btree" ("workflow_id")
WHERE "workflow_id" IS NOT NULL;

-- Comments
COMMENT ON COLUMN "public"."animation_captures"."workflow_id" IS 'Associated workflow ID for upsert support';
COMMENT ON COLUMN "public"."animation_captures"."node_id" IS 'Associated node ID within the workflow for upsert support';
