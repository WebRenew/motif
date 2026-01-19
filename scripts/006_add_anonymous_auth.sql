-- Migration: Add user_id column and update RLS for anonymous auth
-- Run this after enabling Anonymous Auth in Supabase Dashboard

-- Add user_id column to workflows table
ALTER TABLE public.workflows 
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Create index for user_id lookups
CREATE INDEX IF NOT EXISTS idx_workflows_user_id ON public.workflows(user_id);

-- Drop old permissive policies
DROP POLICY IF EXISTS "Allow all operations for anon users on workflows" ON public.workflows;
DROP POLICY IF EXISTS "Allow all operations for anon users on nodes" ON public.workflows;
DROP POLICY IF EXISTS "Allow all operations for anon users on edges" ON public.workflows;

-- Note: The node/edge policies reference the wrong table, let's drop them properly
DROP POLICY IF EXISTS "Allow all operations for anon users on nodes" ON public.nodes;
DROP POLICY IF EXISTS "Allow all operations for anon users on edges" ON public.edges;

-- Create new RLS policies that check auth.uid()
-- Workflows: users can only access their own workflows
CREATE POLICY "Users can access own workflows" 
  ON public.workflows FOR ALL 
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Nodes: users can access nodes in their own workflows
CREATE POLICY "Users can access nodes in own workflows" 
  ON public.nodes FOR ALL 
  USING (
    EXISTS (
      SELECT 1 FROM public.workflows 
      WHERE workflows.id = nodes.workflow_id 
      AND workflows.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.workflows 
      WHERE workflows.id = nodes.workflow_id 
      AND workflows.user_id = auth.uid()
    )
  );

-- Edges: users can access edges in their own workflows
CREATE POLICY "Users can access edges in own workflows" 
  ON public.edges FOR ALL 
  USING (
    EXISTS (
      SELECT 1 FROM public.workflows 
      WHERE workflows.id = edges.workflow_id 
      AND workflows.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.workflows 
      WHERE workflows.id = edges.workflow_id 
      AND workflows.user_id = auth.uid()
    )
  );

-- Optional: Migrate existing workflows from session_id to user_id
-- This would require matching sessions to users, which we can't do automatically
-- Existing data without user_id will be inaccessible until manually migrated
-- You may want to run a one-time migration script if you have important existing data

-- Add comment for documentation
COMMENT ON COLUMN public.workflows.user_id IS 'References auth.users(id) - set via anonymous or authenticated auth';
COMMENT ON COLUMN public.workflows.session_id IS 'Deprecated: Legacy session identifier, kept for backward compatibility';

-- Allow authenticated users to claim workflows that have no user_id yet
-- This enables on-demand migration from session_id to user_id
CREATE POLICY "Allow session to user migration" 
  ON public.workflows 
  FOR UPDATE
  USING (user_id IS NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- Also allow SELECT on unclaimed workflows so we can find them
CREATE POLICY "Allow reading unclaimed workflows by session" 
  ON public.workflows 
  FOR SELECT
  USING (user_id IS NULL);

-- Make session_id nullable since we're now using user_id for authentication
ALTER TABLE public.workflows ALTER COLUMN session_id DROP NOT NULL;

-- Set a default value for backward compatibility
ALTER TABLE public.workflows ALTER COLUMN session_id SET DEFAULT 'deprecated';
