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
| Animation Capture | `app/api/capture-animation/route.ts` - Browserbase capture |
| Canvas | `components/workflow/workflow-canvas.tsx` - main UI |
| Nodes | `components/workflow/{image,prompt,code}-node.tsx` |
| Persistence | `lib/supabase/workflows.ts` - CRUD operations |
| Types | `lib/types/workflow.ts` - WorkflowImage, WorkflowTextInput |
| Auth | `lib/supabase/auth.ts` - user auth helpers |

## Conventions

- `@/` path alias for imports
- `nodesRef`/`edgesRef` for state without re-renders
- Topological sort for execution order (`lib/workflow/topological-sort.ts`)
- Rate limiting fails-closed (503 if Redis unavailable)
- Auto-save debounced 1.5s, skipped during execution
- UUID validation on all database operations
- Anonymous users blocked from premium features (animation capture)

## Node Types

- **imageNode** - image input/output
- **promptNode** - AI operation with model selection
- **codeNode** - code output (tsx, css, json, etc.)

## Animation Capture

Browserbase-powered animation capture with:
- POST `/api/capture-animation` - start capture (auth required)
- GET `/api/capture-animation/[id]?userId=` - poll status (auth required)
- POST `/api/capture-animation/stream` - SSE streaming capture (auth required)
- Cron cleanup runs every 5 minutes for stuck captures (`/api/cron/cleanup-captures`)

### Future Features
- Scroll-triggered animations: auto-scroll to element before capture for below-fold content
- Interaction-triggered animations: support for hover, click, or scroll-based animation triggers

## Environment

```
KV_REST_API_URL, KV_REST_API_TOKEN     # Upstash Redis
NEXT_PUBLIC_SUPABASE_URL               # Supabase
NEXT_PUBLIC_SUPABASE_ANON_KEY          # Supabase anon key
SUPABASE_SERVICE_ROLE_KEY              # Supabase service role (server-side)
BROWSERBASE_API_KEY                    # Browserbase (animation capture)
BROWSERBASE_PROJECT_ID                 # Browserbase project
CRON_SECRET                            # Auto-set by Vercel for cron auth
```
