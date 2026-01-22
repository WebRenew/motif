# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Motif is a multi-step image generation workflow tool built with Next.js that allows users to create visual node-based workflows for AI-powered design tasks. The app supports various design-focused tools including component extraction, color palette generation, typography matching, design critique, and brand kit generation.

The project is synced with v0.app deployments and deployed on Vercel at https://vercel.com/webrenew-team/v0-motif.

## Development Commands

This project uses **pnpm** as the package manager.

```bash
# Install dependencies
pnpm install

# Install Claude Code agent skills (▲ Vercel)
npx skills i vercel-labs/agent-skills

# Development server
pnpm dev

# Build for production
pnpm build

# Start production server
pnpm start

# Run ESLint
pnpm lint

# Supabase local development (requires Docker)
pnpm db:start    # Start local Supabase
pnpm db:status   # Check status
pnpm db:reset    # Reset database
pnpm db:stop     # Stop Supabase
```

## Architecture

### Tech Stack
- **Framework**: Next.js 16.0.10 with App Router
- **React**: 19.2.0 with TypeScript
- **Styling**: Tailwind CSS v4 with custom design tokens
- **Workflow Canvas**: @xyflow/react for node-based UI
- **AI Integration**: Vercel AI SDK (`ai` package) with multiple model providers
- **State**: Supabase for workflow persistence
- **Rate Limiting**: Upstash Redis with global rate limit (100 generations/hour)
- **Analytics**: Vercel Analytics

### Key Directories

- `app/` - Next.js App Router pages and API routes
  - `app/api/generate-image/route.ts` - Central API endpoint for all AI model calls
  - `app/tools/[tool]/` - Dynamic routes for specialized workflow tools
- `components/` - React components, primarily workflow-related nodes
  - `components/workflow/` - Core workflow canvas and node components
- `lib/` - Utilities and business logic
  - `lib/workflow/` - Workflow creation, node factories, topological sorting
  - `lib/supabase/` - Database client, storage, workflow persistence
  - `lib/schemas/` - Zod schemas for structured outputs
  - `lib/rate-limit.ts` - Global rate limiting logic

### Core Architecture Patterns

**Workflow System**: The app uses a node-based workflow system where:
- Nodes represent inputs (images), prompts (AI operations), or outputs (code/images)
- Edges connect nodes to define data flow
- Workflows execute in topological order based on node dependencies
- Each prompt node can output either images or text/code

**AI Generation Flow**:
1. User configures prompt nodes with text and model selection
2. Input images flow from upstream nodes via edges
3. `/api/generate-image` routes to appropriate model type:
   - `GEMINI_IMAGE` - Gemini models that generate images (with vision input)
   - `IMAGE_ONLY` - Pure image generation models (Flux, Imagen)
   - `VISION_TEXT` - Vision models that output text/code (Claude, GPT-4)
   - `TEXT_ONLY` - Text-only models
4. Results populate downstream output nodes (imageNode or codeNode)

**State Management**:
- Local React state for UI interactions
- `nodesRef` and `edgesRef` for tracking workflow state without re-renders
- Auto-save to Supabase every 3 seconds when workflow is dirty
- Session-based storage with unique session IDs

**Tool Workflows**: Predefined workflows in `lib/workflow/tool-workflows.ts` provide specialized templates:
- Component Extractor - Convert designs to React/TSX code
- Color Palette - Extract color systems from images
- Typography Matcher - Identify fonts and suggest pairings
- Design Critique - AI feedback on UI screenshots
- Brand Kit Generator - Complete brand system from logo

### Model Routing

The `/api/generate-image` endpoint intelligently routes requests based on:
- Model capabilities (vision, image generation, text-only)
- Prompt analysis (detects stylesheet/CSS/theme requests)
- Target language (tsx, css, json, etc.)
- Whether structured output is needed (uses Zod schemas)

### Important Implementation Details

**Path Aliases**: Use `@/` for absolute imports (configured in tsconfig.json):
```typescript
import { WorkflowCanvas } from "@/components/workflow/workflow-canvas"
import { checkRateLimit } from "@/lib/rate-limit"
```

**Image Handling**:
- Input images can be base64 data URLs or public URLs
- Generated base64 images are uploaded to Supabase Storage
- Seed images are initialized from Supabase on workflow creation

**Topological Sorting**: Workflows execute prompt nodes in dependency order using `lib/workflow/topological-sort.ts` to ensure upstream nodes complete before downstream nodes.

**Rate Limiting**: Global limit applies to all users - 100 generations per hour. Check `lib/rate-limit.ts` before modifying limits.

## Environment Variables

Required for full functionality:
- `KV_REST_API_URL` - Upstash Redis URL for rate limiting
- `KV_REST_API_TOKEN` - Upstash Redis token
- Supabase credentials (inferred from `@supabase/ssr` and storage usage)

## Linting Configuration

The project uses a flat ESLint config (`eslint.config.mjs`) with:
- TypeScript ESLint recommended rules
- Next.js plugin with core-web-vitals rules
- React and React Hooks plugins
- Custom rules: unused vars as warnings (with `_` prefix ignore pattern)
- Type safety: `@typescript-eslint/prefer-as-const` as error
- `no-console` is OFF (console logs are allowed)

TypeScript strict mode is enabled with `ignoreBuildErrors: false` in next.config.mjs.

## Node Types

Three node types power the workflow system:

1. **imageNode** - Image inputs/outputs with aspect ratio control
2. **promptNode** - AI operation nodes with model selection, prompt text, and execution state
3. **codeNode** - Code output nodes with syntax highlighting (supports tsx, css, json, etc.)

Node factories in `lib/workflow/node-factories.ts` create properly typed nodes with default configurations.

## Design System

The app uses Tailwind v4 with custom CSS variables defined in `app/globals.css`. Design tokens include:
- Color system using oklch() color space
- Custom grid background pattern (`.bg-grid-plus`)
- Gradient glow effects for UI elements
- Geist and Geist Mono fonts for typography
