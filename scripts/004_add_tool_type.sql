-- Add tool_type column to workflows for distinguishing different tool canvases
ALTER TABLE public.workflows 
ADD COLUMN IF NOT EXISTS tool_type TEXT DEFAULT 'style-fusion';

-- Add index for tool_type queries
CREATE INDEX IF NOT EXISTS idx_workflows_tool_type ON public.workflows(tool_type);

-- Update comment for clarity
COMMENT ON COLUMN public.workflows.tool_type IS 'Tool identifier: style-fusion, component-extractor, color-palette, typography-matcher, design-critique, brand-kit';
