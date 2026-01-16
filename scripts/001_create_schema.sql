-- Create workflows table for storing workflow metadata
CREATE TABLE IF NOT EXISTS public.workflows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL,
  name TEXT DEFAULT 'Untitled Workflow',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create nodes table for storing individual nodes
CREATE TABLE IF NOT EXISTS public.nodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID NOT NULL REFERENCES public.workflows(id) ON DELETE CASCADE,
  node_id TEXT NOT NULL,
  node_type TEXT NOT NULL CHECK (node_type IN ('image', 'prompt', 'code')),
  position_x FLOAT NOT NULL DEFAULT 0,
  position_y FLOAT NOT NULL DEFAULT 0,
  width FLOAT,
  height FLOAT,
  data JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(workflow_id, node_id)
);

-- Create edges table for storing connections between nodes
CREATE TABLE IF NOT EXISTS public.edges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID NOT NULL REFERENCES public.workflows(id) ON DELETE CASCADE,
  edge_id TEXT NOT NULL,
  source_node_id TEXT NOT NULL,
  target_node_id TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(workflow_id, edge_id)
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_workflows_session_id ON public.workflows(session_id);
CREATE INDEX IF NOT EXISTS idx_nodes_workflow_id ON public.nodes(workflow_id);
CREATE INDEX IF NOT EXISTS idx_edges_workflow_id ON public.edges(workflow_id);

-- Enable Row Level Security
ALTER TABLE public.workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.edges ENABLE ROW LEVEL SECURITY;

-- RLS Policies for workflows (anon users access by session_id passed in request)
-- Since we're allowing anon users, we use a more permissive policy
CREATE POLICY "Allow all operations for anon users on workflows" 
  ON public.workflows FOR ALL 
  USING (true) 
  WITH CHECK (true);

CREATE POLICY "Allow all operations for anon users on nodes" 
  ON public.nodes FOR ALL 
  USING (true) 
  WITH CHECK (true);

CREATE POLICY "Allow all operations for anon users on edges" 
  ON public.edges FOR ALL 
  USING (true) 
  WITH CHECK (true);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add triggers for updated_at
DROP TRIGGER IF EXISTS set_workflows_updated_at ON public.workflows;
CREATE TRIGGER set_workflows_updated_at
  BEFORE UPDATE ON public.workflows
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_nodes_updated_at ON public.nodes;
CREATE TRIGGER set_nodes_updated_at
  BEFORE UPDATE ON public.nodes
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();
