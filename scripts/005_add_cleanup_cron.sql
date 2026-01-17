-- Migration: Add pg_cron cleanup job for stale workflows
-- Deletes workflows (and cascaded nodes/edges) not updated in 30 days
-- Runs daily at 3 AM UTC

-- Enable pg_cron extension
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;

-- Create cleanup function with logging
CREATE OR REPLACE FUNCTION cleanup_stale_workflows()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  deleted_count integer;
  deleted_nodes integer;
  deleted_edges integer;
BEGIN
  -- Get counts before deletion for logging
  SELECT COUNT(*) INTO deleted_nodes 
  FROM nodes n 
  JOIN workflows w ON n.workflow_id = w.id 
  WHERE w.updated_at < NOW() - INTERVAL '30 days';
  
  SELECT COUNT(*) INTO deleted_edges 
  FROM edges e 
  JOIN workflows w ON e.workflow_id = w.id 
  WHERE w.updated_at < NOW() - INTERVAL '30 days';

  -- Delete stale workflows (cascades to nodes and edges)
  WITH deleted AS (
    DELETE FROM workflows
    WHERE updated_at < NOW() - INTERVAL '30 days'
    RETURNING id
  )
  SELECT COUNT(*) INTO deleted_count FROM deleted;

  -- Return summary
  RETURN jsonb_build_object(
    'deleted_workflows', deleted_count,
    'deleted_nodes', deleted_nodes,
    'deleted_edges', deleted_edges,
    'executed_at', NOW()
  );
END;
$$;

-- Schedule daily cleanup at 3 AM UTC
SELECT cron.schedule(
  'cleanup-stale-workflows',
  '0 3 * * *',
  $$SELECT cleanup_stale_workflows()$$
);

-- To manually run: SELECT cleanup_stale_workflows();
-- To check job status: SELECT * FROM cron.job;
-- To view job history: SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 10;
-- To unschedule: SELECT cron.unschedule('cleanup-stale-workflows');
