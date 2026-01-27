-- Agent conversations and messages tables
-- Plus user settings for agent rules

-- Create agent_conversations table
CREATE TABLE IF NOT EXISTS "public"."agent_conversations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "workflow_id" "uuid",
    "title" "text",
    "is_favorite" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "agent_conversations_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "agent_conversations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE,
    CONSTRAINT "agent_conversations_workflow_id_fkey" FOREIGN KEY ("workflow_id") REFERENCES "public"."workflows"("id") ON DELETE SET NULL
);

-- Create agent_messages table
CREATE TABLE IF NOT EXISTS "public"."agent_messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "conversation_id" "uuid" NOT NULL,
    "role" "text" NOT NULL,
    "content" "text" NOT NULL,
    "metadata" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "agent_messages_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "agent_messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "public"."agent_conversations"("id") ON DELETE CASCADE,
    CONSTRAINT "agent_messages_role_check" CHECK (("role" = ANY (ARRAY['user'::"text", 'assistant'::"text", 'system'::"text"])))
);

-- Create user_settings table for agent rules and other user preferences
CREATE TABLE IF NOT EXISTS "public"."user_settings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL UNIQUE,
    "agent_rules" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "user_settings_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "user_settings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE,
    CONSTRAINT "agent_rules_length" CHECK (("agent_rules" IS NULL OR char_length("agent_rules") <= 500))
);

-- Add indexes
CREATE INDEX "idx_agent_conversations_user_id" ON "public"."agent_conversations" USING "btree" ("user_id");
CREATE INDEX "idx_agent_conversations_workflow_id" ON "public"."agent_conversations" USING "btree" ("workflow_id");
CREATE INDEX "idx_agent_conversations_updated_at" ON "public"."agent_conversations" USING "btree" ("updated_at" DESC);
CREATE INDEX "idx_agent_conversations_favorite" ON "public"."agent_conversations" USING "btree" ("user_id", "is_favorite") WHERE ("is_favorite" = true);
CREATE INDEX "idx_agent_messages_conversation_id" ON "public"."agent_messages" USING "btree" ("conversation_id");
CREATE INDEX "idx_agent_messages_created_at" ON "public"."agent_messages" USING "btree" ("conversation_id", "created_at");

-- Add updated_at triggers
CREATE OR REPLACE TRIGGER "set_agent_conversations_updated_at" 
    BEFORE UPDATE ON "public"."agent_conversations" 
    FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();

CREATE OR REPLACE TRIGGER "set_user_settings_updated_at" 
    BEFORE UPDATE ON "public"."user_settings" 
    FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();

-- Enable RLS
ALTER TABLE "public"."agent_conversations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."agent_messages" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."user_settings" ENABLE ROW LEVEL SECURITY;

-- RLS policies for agent_conversations
CREATE POLICY "agent_conversations_access_policy" ON "public"."agent_conversations"
    USING (("user_id" = (SELECT "auth"."uid"() AS "uid")))
    WITH CHECK (("user_id" = (SELECT "auth"."uid"() AS "uid")));

-- RLS policies for agent_messages (access via conversation ownership)
CREATE POLICY "agent_messages_access_policy" ON "public"."agent_messages"
    USING ((EXISTS (
        SELECT 1 FROM "public"."agent_conversations"
        WHERE "agent_conversations"."id" = "agent_messages"."conversation_id"
        AND "agent_conversations"."user_id" = (SELECT "auth"."uid"() AS "uid")
    )))
    WITH CHECK ((EXISTS (
        SELECT 1 FROM "public"."agent_conversations"
        WHERE "agent_conversations"."id" = "agent_messages"."conversation_id"
        AND "agent_conversations"."user_id" = (SELECT "auth"."uid"() AS "uid")
    )));

-- RLS policies for user_settings
CREATE POLICY "user_settings_access_policy" ON "public"."user_settings"
    USING (("user_id" = (SELECT "auth"."uid"() AS "uid")))
    WITH CHECK (("user_id" = (SELECT "auth"."uid"() AS "uid")));

-- Grant permissions
GRANT ALL ON TABLE "public"."agent_conversations" TO "anon";
GRANT ALL ON TABLE "public"."agent_conversations" TO "authenticated";
GRANT ALL ON TABLE "public"."agent_conversations" TO "service_role";

GRANT ALL ON TABLE "public"."agent_messages" TO "anon";
GRANT ALL ON TABLE "public"."agent_messages" TO "authenticated";
GRANT ALL ON TABLE "public"."agent_messages" TO "service_role";

GRANT ALL ON TABLE "public"."user_settings" TO "anon";
GRANT ALL ON TABLE "public"."user_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."user_settings" TO "service_role";
