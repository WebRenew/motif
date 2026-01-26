# Motif

> **An AI-powered design workflow tool by [Webrenew](https://webrenew.com), built with [v0](https://v0.app)**

[![Deployed on Vercel](https://img.shields.io/badge/Deployed%20on-Vercel-black?style=for-the-badge&logo=vercel)](https://vercel.com/webrenew-team/v0-motif)
[![Built with v0](https://img.shields.io/badge/Built%20with-v0.app-black?style=for-the-badge)](https://v0.link/VJ5mqrg)
[![License](https://img.shields.io/badge/License-AGPL%20v3-blue.svg?style=for-the-badge)](LICENSE)

**[Try Motif →](https://motif.webrenew.com)**

![Motif Workflow Canvas](/public/images/motif-workflow-screenshot.webp)

## Overview

**Motif** is a multi-step image generation workflow tool that enables visual, node-based workflows for AI-powered design tasks. Created by **Webrenew** and **built primarily in [v0](https://v0.app)**, Motif empowers designers and developers to build custom workflows that extract components from designs, generate color palettes, match typography, critique UI designs, and create complete brand systems.

### Built With Modern AI Infrastructure

Motif showcases the power of modern AI development tools:

- **v0** - Primary development platform for rapid UI and feature iteration
- **Claude Code** - AI-powered coding agent for complex implementation and refactoring
- **▲ Vercel AI SDK 6** - Powers multi-model AI integration (Claude, GPT-4, Gemini, Flux)
- **AI Gateway** - Intelligent routing and management of AI model requests
- **Next.js 16** - App Router with React Server Components
- **Tailwind CSS v4** - Modern utility-first styling with design tokens

### About Webrenew

[Webrenew](https://webrenew.com) is a digital agency specializing in modern web development, AI integration, and design systems. We build tools that enhance designer and developer productivity.

> **Note:** This repository includes additional features beyond the [v0 template](https://v0.link/VJ5mqrg). The template provides a starting point, while this repo contains production enhancements built with Claude Code including undo/redo, per-user rate limiting, workflow validation, and more.

## Features

### AI-Powered Workflows
- **Visual Workflow Builder** - Drag-and-drop node-based interface powered by React Flow
- **Multi-Model AI Integration** - Seamlessly switch between Claude Sonnet 4.5, GPT-4, Gemini 3 Pro, Flux, and more via AI SDK 6
- **Intelligent Model Routing** - AI Gateway automatically routes requests to the optimal model based on task type
- **Structured Outputs** - Generate validated TypeScript, CSS, JSON with Zod schemas

### Pre-built Design Tools
Built and refined in v0 for maximum productivity:
- **Component Extractor** - Convert designs to React/TSX code
- **Color Palette Generator** - Extract color systems from images
- **Typography Matcher** - Identify fonts and get pairings
- **Design Critique** - AI-powered UI feedback
- **Brand Kit Generator** - Complete brand systems from logos

### Production Features
- **Workflow Persistence** - Auto-save to Supabase with session management
- **Global Rate Limiting** - Upstash Redis-powered fair usage controls
- **Image Management** - Supabase Storage with automatic base64 → URL conversion
- **Real-time Analytics** - Vercel Analytics integration

## Development

This project uses **pnpm** as the package manager.

```bash
# Install dependencies
pnpm install

# Install Claude Code agent skills (▲ Vercel)
npx skills i vercel-labs/agent-skills

# Run development server
pnpm dev

# Build for production
pnpm build

# Run linting
pnpm lint
```

### Supabase Local Development

```bash
# Start local Supabase (Docker required)
pnpm db:start

# Check status
pnpm db:status

# Reset database
pnpm db:reset

# Stop Supabase
pnpm db:stop
```

## Environment Variables

Copy `.env.example` to `.env.local` and fill in your credentials:

| Variable | Required | Description |
|----------|----------|-------------|
| `KV_REST_API_URL` | Yes | Upstash Redis URL for rate limiting |
| `KV_REST_API_TOKEN` | Yes | Upstash Redis token |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anonymous key |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Supabase service role key (server-side) |
| `BROWSERBASE_API_KEY` | Optional | Browserbase API key for animation capture |
| `BROWSERBASE_PROJECT_ID` | Optional | Browserbase project ID |
| `CRON_SECRET` | Auto | Vercel auto-generates for cron authentication |

See [`.env.example`](.env.example) for the complete list.

## Self-Hosting

### Prerequisites

- Node.js 18+
- pnpm
- Docker (for local Supabase)
- Accounts: [Supabase](https://supabase.com), [Upstash](https://upstash.com), optionally [Browserbase](https://browserbase.com)

### Quick Start

```bash
# Clone and install
git clone https://github.com/webrenew/motif.git
cd motif
pnpm install

# Set up environment
cp .env.example .env.local
# Edit .env.local with your credentials

# Start local Supabase
pnpm db:start

# Run development server
pnpm dev
```

### Deploy to Vercel

1. Push to GitHub
2. Import in [Vercel](https://vercel.com/new)
3. Add environment variables in Vercel dashboard
4. Deploy

Vercel automatically:
- Runs the cron job (`/api/cron/cleanup-captures`) every 5 minutes
- Generates and injects `CRON_SECRET` for cron authentication

### Supabase Setup

1. Create a new Supabase project
2. Run the migrations in `supabase/migrations/` or use:
   ```bash
   pnpm db:push  # Push local schema to remote
   ```
3. Create storage buckets:
   - `workflow-images` (public)
   - `animation-screenshots` (public)

### Optional: Animation Capture

Animation capture requires [Browserbase](https://browserbase.com):

1. Sign up at browserbase.com
2. Create a project and get API credentials
3. Add `BROWSERBASE_API_KEY` and `BROWSERBASE_PROJECT_ID` to environment
4. Feature is automatically enabled when credentials are present

**Note:** Animation capture requires authenticated (non-anonymous) users.

## Tech Stack

Motif leverages cutting-edge AI development tools:

| Technology | Purpose |
|------------|---------|
| **v0** | Primary development platform - UI components, workflows, and rapid iteration |
| **Vercel AI SDK 6** | Multi-model AI orchestration with streaming, structured outputs, and tool calling |
| **AI Gateway** | Intelligent model routing, caching, and request optimization |
| **Next.js 16** | App Router with React Server Components and streaming |
| **React Flow** | Visual workflow canvas with node-based interactions |
| **Tailwind CSS v4** | Utility-first CSS with modern design tokens (oklch colors) |
| **Supabase** | PostgreSQL database and object storage |
| **Upstash Redis** | Global rate limiting with sliding window algorithm |
| **TypeScript 5** | Type-safe development with strict mode |

## v0 Development Workflow

This project originated in [v0](https://v0.app) and uses automatic repository sync. Additional features were built using Claude Code on top of the v0 foundation.

1. Create and modify components using [v0.app](https://v0.app)
2. Deploy your chats from the v0 interface
3. Changes are automatically pushed to this repository
4. Vercel deploys the latest version from this repository

## Claude Code Setup

If you're using [Claude Code](https://claude.ai/code) for development, install the Vercel agent skills first:

```bash
npx skills i vercel-labs/agent-skills
```

This gives Claude Code knowledge of Vercel-specific patterns, deployment workflows, and AI SDK best practices used throughout this codebase.

## AI SDK 6 Integration

Motif uses the latest Vercel AI SDK features:

```typescript
// Multi-model text generation with vision
import { generateText } from 'ai'

const result = await generateText({
  model: 'anthropic/claude-sonnet-4-5',
  messages: [{
    role: 'user',
    content: [
      { type: 'image', image: inputImage },
      { type: 'text', text: prompt }
    ]
  }]
})
```

```typescript
// Structured outputs with Zod
import { generateObject } from 'ai'

const result = await generateObject({
  model: 'anthropic/claude-sonnet-4-5',
  schema: tailwindThemeSchema,
  messages: [{ role: 'user', content: messageContent }]
})
```

## Acknowledgments

Motif was built as part of the [v0 Ambassador Program](https://v0.app). Special thanks to the **Vercel** and **v0 teams** for creating exceptional tools that make AI-powered development accessible and productive.

- [v0](https://v0.app) — AI-powered UI development platform
- [Claude Code](https://claude.ai/code) — AI coding agent by Anthropic
- [Vercel AI SDK](https://sdk.vercel.ai) — The TypeScript toolkit for building AI applications
- [Vercel](https://vercel.com) — Frontend cloud platform

## License

This project is licensed under the GNU Affero General Public License v3.0 (AGPL-3.0) - see the [LICENSE](LICENSE) file for details.

**What this means:**
- Free to use, modify, and distribute
- Can be used commercially
- Must include a copy of the license and source code
- Must state significant changes made
- Must preserve copyright and attribution notices
- **Network use triggers copyleft**: If you modify and run this software as a network service, you must make your modified source code available to users of that service
- Derivative works must also be licensed under AGPL-3.0