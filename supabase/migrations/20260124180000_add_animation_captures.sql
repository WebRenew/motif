-- Animation captures table for storing captured animation data from websites
-- Used by the animation capture feature to persist session data and extracted CSS

CREATE TABLE IF NOT EXISTS "public"."animation_captures" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "url" "text" NOT NULL,
    "page_title" "text",
    "selector" "text",
    "duration" integer DEFAULT 3000,
    "replay_url" "text",
    "session_id" "text",
    "animation_context" "jsonb" DEFAULT '{}'::"jsonb",
    "screenshot_before" "text",
    "screenshot_after" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "animation_captures_duration_check" CHECK (("duration" >= 1000 AND "duration" <= 10000))
);

ALTER TABLE "public"."animation_captures" OWNER TO "postgres";

COMMENT ON TABLE "public"."animation_captures" IS 'Stores captured animation data from websites for recreation';
COMMENT ON COLUMN "public"."animation_captures"."url" IS 'Source URL where animation was captured';
COMMENT ON COLUMN "public"."animation_captures"."selector" IS 'CSS selector used to target specific element (optional)';
COMMENT ON COLUMN "public"."animation_captures"."duration" IS 'Capture duration in milliseconds (1000-10000)';
COMMENT ON COLUMN "public"."animation_captures"."replay_url" IS 'Browserbase session replay URL';
COMMENT ON COLUMN "public"."animation_captures"."session_id" IS 'Browserbase session ID';
COMMENT ON COLUMN "public"."animation_captures"."animation_context" IS 'JSON containing frames, keyframes, libraries, computed styles, html, boundingBox';
COMMENT ON COLUMN "public"."animation_captures"."screenshot_before" IS 'Base64 JPEG screenshot before animation';
COMMENT ON COLUMN "public"."animation_captures"."screenshot_after" IS 'Base64 JPEG screenshot after animation';

-- Primary key
ALTER TABLE ONLY "public"."animation_captures"
    ADD CONSTRAINT "animation_captures_pkey" PRIMARY KEY ("id");

-- Foreign key to auth.users
ALTER TABLE ONLY "public"."animation_captures"
    ADD CONSTRAINT "animation_captures_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;

-- Index for user lookups
CREATE INDEX "idx_animation_captures_user_id" ON "public"."animation_captures" USING "btree" ("user_id");

-- Index for URL lookups (for potential caching)
CREATE INDEX "idx_animation_captures_url" ON "public"."animation_captures" USING "btree" ("url");

-- Trigger for updated_at
CREATE OR REPLACE TRIGGER "set_animation_captures_updated_at" 
    BEFORE UPDATE ON "public"."animation_captures" 
    FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();

-- Enable Row Level Security
ALTER TABLE "public"."animation_captures" ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only access their own captures
CREATE POLICY "animation_captures_access_policy" ON "public"."animation_captures"
    USING (("user_id" = (SELECT "auth"."uid"() AS "uid")))
    WITH CHECK ((SELECT "auth"."uid"() AS "uid") IS NOT NULL);

-- Grant permissions
GRANT ALL ON TABLE "public"."animation_captures" TO "anon";
GRANT ALL ON TABLE "public"."animation_captures" TO "authenticated";
GRANT ALL ON TABLE "public"."animation_captures" TO "service_role";
