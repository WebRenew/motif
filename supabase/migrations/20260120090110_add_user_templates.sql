-- Migration: Add user template support to workflows
-- Allows users to save custom workflows as reusable templates with icons and tags

-- Add template-related columns to workflows table
ALTER TABLE public.workflows
ADD COLUMN IF NOT EXISTS is_template BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS template_icon TEXT DEFAULT 'workflow',
ADD COLUMN IF NOT EXISTS template_tags TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS description TEXT;

-- Create index for template queries
CREATE INDEX IF NOT EXISTS idx_workflows_is_template ON public.workflows(user_id, is_template)
WHERE is_template = true;

-- Create index for tag searches (using GIN for array searches)
CREATE INDEX IF NOT EXISTS idx_workflows_tags ON public.workflows USING GIN(template_tags);

-- Add comments for documentation
COMMENT ON COLUMN public.workflows.is_template IS 'Whether this workflow is saved as a reusable template';
COMMENT ON COLUMN public.workflows.template_icon IS 'Icon identifier for the template (e.g., star, heart, sparkles)';
COMMENT ON COLUMN public.workflows.template_tags IS 'Array of tags for organizing and searching templates';
COMMENT ON COLUMN public.workflows.description IS 'Optional description of what the template does';
