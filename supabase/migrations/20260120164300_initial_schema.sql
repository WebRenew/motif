-- Baseline schema pulled from the live Supabase project (single migration).
-- This file intentionally mirrors the current database state.

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE OR REPLACE FUNCTION "public"."cleanup_stale_workflows"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  -- Delete workflows older than 7 days
  DELETE FROM public.workflows
  WHERE updated_at < NOW() - INTERVAL '7 days';
END;
$$;


ALTER FUNCTION "public"."cleanup_stale_workflows"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_updated_at"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."edges" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "workflow_id" "uuid" NOT NULL,
    "edge_id" "text" NOT NULL,
    "source_node_id" "text" NOT NULL,
    "target_node_id" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."edges" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."nodes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "workflow_id" "uuid" NOT NULL,
    "node_id" "text" NOT NULL,
    "node_type" "text" NOT NULL,
    "position_x" double precision DEFAULT 0 NOT NULL,
    "position_y" double precision DEFAULT 0 NOT NULL,
    "width" double precision,
    "height" double precision,
    "data" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "nodes_node_type_check" CHECK (("node_type" = ANY (ARRAY['image'::"text", 'prompt'::"text", 'code'::"text", 'imageNode'::"text", 'promptNode'::"text", 'codeNode'::"text"])))
);


ALTER TABLE "public"."nodes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."workflows" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "session_id" "text" DEFAULT 'deprecated'::"text",
    "name" "text" DEFAULT 'Untitled Workflow'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "tool_type" "text" DEFAULT 'style-fusion'::"text",
    "user_id" "uuid",
    "is_template" boolean DEFAULT false,
    "template_icon" "text" DEFAULT 'workflow'::"text",
    "template_tags" "text"[] DEFAULT '{}'::"text"[],
    "description" "text"
);


ALTER TABLE "public"."workflows" OWNER TO "postgres";


COMMENT ON COLUMN "public"."workflows"."session_id" IS 'Deprecated: Legacy session identifier, kept for backward compatibility';


COMMENT ON COLUMN "public"."workflows"."tool_type" IS 'Tool identifier: style-fusion, component-extractor, color-palette, typography-matcher, design-critique, brand-kit';


COMMENT ON COLUMN "public"."workflows"."user_id" IS 'References auth.users(id) - set via anonymous or authenticated auth';


COMMENT ON COLUMN "public"."workflows"."is_template" IS 'Whether this workflow is saved as a reusable template';


COMMENT ON COLUMN "public"."workflows"."template_icon" IS 'Icon identifier for the template (e.g., star, heart, sparkles)';


COMMENT ON COLUMN "public"."workflows"."template_tags" IS 'Array of tags for organizing and searching templates';


COMMENT ON COLUMN "public"."workflows"."description" IS 'Optional description of what the template does';


ALTER TABLE ONLY "public"."edges"
    ADD CONSTRAINT "edges_pkey" PRIMARY KEY ("id");


ALTER TABLE ONLY "public"."edges"
    ADD CONSTRAINT "edges_workflow_id_edge_id_key" UNIQUE ("workflow_id", "edge_id");


ALTER TABLE ONLY "public"."nodes"
    ADD CONSTRAINT "nodes_pkey" PRIMARY KEY ("id");


ALTER TABLE ONLY "public"."nodes"
    ADD CONSTRAINT "nodes_workflow_id_node_id_key" UNIQUE ("workflow_id", "node_id");


ALTER TABLE ONLY "public"."workflows"
    ADD CONSTRAINT "workflows_pkey" PRIMARY KEY ("id");


CREATE INDEX "idx_edges_workflow_id" ON "public"."edges" USING "btree" ("workflow_id");


CREATE INDEX "idx_nodes_workflow_id" ON "public"."nodes" USING "btree" ("workflow_id");


CREATE INDEX "idx_workflows_is_template" ON "public"."workflows" USING "btree" ("user_id", "is_template") WHERE ("is_template" = true);


CREATE INDEX "idx_workflows_session_id" ON "public"."workflows" USING "btree" ("session_id");


CREATE INDEX "idx_workflows_tags" ON "public"."workflows" USING "gin" ("template_tags");


CREATE INDEX "idx_workflows_tool_type" ON "public"."workflows" USING "btree" ("tool_type");


CREATE INDEX "idx_workflows_user_id" ON "public"."workflows" USING "btree" ("user_id");


CREATE OR REPLACE TRIGGER "set_nodes_updated_at" BEFORE UPDATE ON "public"."nodes" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();


CREATE OR REPLACE TRIGGER "set_workflows_updated_at" BEFORE UPDATE ON "public"."workflows" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();


ALTER TABLE ONLY "public"."edges"
    ADD CONSTRAINT "edges_workflow_id_fkey" FOREIGN KEY ("workflow_id") REFERENCES "public"."workflows"("id") ON DELETE CASCADE;


ALTER TABLE ONLY "public"."nodes"
    ADD CONSTRAINT "nodes_workflow_id_fkey" FOREIGN KEY ("workflow_id") REFERENCES "public"."workflows"("id") ON DELETE CASCADE;


ALTER TABLE ONLY "public"."workflows"
    ADD CONSTRAINT "workflows_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;


ALTER TABLE "public"."edges" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "edges_access_policy" ON "public"."edges" USING ((EXISTS ( SELECT 1
   FROM "public"."workflows"
  WHERE (("workflows"."id" = "edges"."workflow_id") AND ("workflows"."user_id" = ( SELECT "auth"."uid"() AS "uid")))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."workflows"
  WHERE (("workflows"."id" = "edges"."workflow_id") AND ("workflows"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))));


ALTER TABLE "public"."nodes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "nodes_access_policy" ON "public"."nodes" USING ((EXISTS ( SELECT 1
   FROM "public"."workflows"
  WHERE (("workflows"."id" = "nodes"."workflow_id") AND ("workflows"."user_id" = ( SELECT "auth"."uid"() AS "uid")))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."workflows"
  WHERE (("workflows"."id" = "nodes"."workflow_id") AND ("workflows"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))));


ALTER TABLE "public"."workflows" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "workflows_access_policy" ON "public"."workflows" USING ((("user_id" = ( SELECT "auth"."uid"() AS "uid")) OR ("user_id" IS NULL))) WITH CHECK ((( SELECT "auth"."uid"() AS "uid") IS NOT NULL));


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";


GRANT ALL ON FUNCTION "public"."cleanup_stale_workflows"() TO "anon";
GRANT ALL ON FUNCTION "public"."cleanup_stale_workflows"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."cleanup_stale_workflows"() TO "service_role";


GRANT ALL ON FUNCTION "public"."handle_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_updated_at"() TO "service_role";


GRANT ALL ON TABLE "public"."edges" TO "anon";
GRANT ALL ON TABLE "public"."edges" TO "authenticated";
GRANT ALL ON TABLE "public"."edges" TO "service_role";


GRANT ALL ON TABLE "public"."nodes" TO "anon";
GRANT ALL ON TABLE "public"."nodes" TO "authenticated";
GRANT ALL ON TABLE "public"."nodes" TO "service_role";


GRANT ALL ON TABLE "public"."workflows" TO "anon";
GRANT ALL ON TABLE "public"."workflows" TO "authenticated";
GRANT ALL ON TABLE "public"."workflows" TO "service_role";


ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";


ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";


ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";

CREATE EXTENSION IF NOT EXISTS "pg_cron" WITH SCHEMA "pg_catalog";

DROP EXTENSION IF EXISTS "pg_net";

CREATE POLICY "Allow anon delete for workflow images"
  ON "storage"."objects"
  AS PERMISSIVE
  FOR DELETE
  TO public
USING ((bucket_id = 'workflow-images'::text));

CREATE POLICY "Allow anon update for workflow images"
  ON "storage"."objects"
  AS PERMISSIVE
  FOR UPDATE
  TO public
USING ((bucket_id = 'workflow-images'::text));

CREATE POLICY "Allow anon upload for workflow images"
  ON "storage"."objects"
  AS PERMISSIVE
  FOR INSERT
  TO public
WITH CHECK ((bucket_id = 'workflow-images'::text));

CREATE POLICY "Public read access for workflow images"
  ON "storage"."objects"
  AS PERMISSIVE
  FOR SELECT
  TO public
USING ((bucket_id = 'workflow-images'::text));
