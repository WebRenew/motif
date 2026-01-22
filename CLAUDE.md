# CLAUDE.md

## What is Motif

Node-based AI workflow tool for design tasks. Users connect image/prompt/code nodes, execute workflows, generate images and code.

**Stack**: Next.js 16 + React 19 + Tailwind v4 + @xyflow/react + Vercel AI SDK + Supabase + Upstash Redis

## Commands

```bash
pnpm dev          # Development
pnpm build        # Production build
pnpm lint         # ESLint
pnpm db:start     # Local Supabase (Docker)
```

## Key Files

| Area | Files |
|------|-------|
| API | `app/api/generate-image/route.ts` - all AI generation |
| Canvas | `components/workflow/workflow-canvas.tsx` - main UI |
| Nodes | `components/workflow/{image,prompt,code}-node.tsx` |
| Persistence | `lib/supabase/workflows.ts` - CRUD operations |
| Types | `lib/types/workflow.ts` - WorkflowImage, WorkflowTextInput |

## Conventions

- `@/` path alias for imports
- `nodesRef`/`edgesRef` for state without re-renders
- Topological sort for execution order (`lib/workflow/topological-sort.ts`)
- Rate limiting fails-closed (503 if Redis unavailable)
- Auto-save debounced 1.5s, skipped during execution
- UUID validation on all database operations

## Node Types

- **imageNode** - image input/output
- **promptNode** - AI operation with model selection
- **codeNode** - code output (tsx, css, json, etc.)

## Environment

```
KV_REST_API_URL, KV_REST_API_TOKEN     # Upstash Redis
NEXT_PUBLIC_SUPABASE_URL               # Supabase
```
