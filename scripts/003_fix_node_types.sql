-- Fix node_type constraint to match React Flow node types
ALTER TABLE public.nodes DROP CONSTRAINT IF EXISTS nodes_node_type_check;
ALTER TABLE public.nodes ADD CONSTRAINT nodes_node_type_check 
  CHECK (node_type IN ('image', 'prompt', 'code', 'imageNode', 'promptNode', 'codeNode'));
