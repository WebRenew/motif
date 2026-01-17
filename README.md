# motif

> **An AI-powered design workflow tool by [Webrenew](https://webrenew.com) in partnership with [Vercel's v0](https://v0.app)**

[![Deployed on Vercel](https://img.shields.io/badge/Deployed%20on-Vercel-black?style=for-the-badge&logo=vercel)](https://vercel.com/webrenew-team/v0-motif)
[![Built with v0](https://img.shields.io/badge/Built%20with-v0.app-black?style=for-the-badge)](https://v0.app/chat/fwpS3A5mwQi)
[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg?style=for-the-badge)](LICENSE)

## Overview

**Motif** is a multi-step image generation workflow tool that enables visual, node-based workflows for AI-powered design tasks. Created by **Webrenew** and **built primarily in [v0](https://v0.app)**, Motif empowers designers and developers to build custom workflows that extract components from designs, generate color palettes, match typography, critique UI designs, and create complete brand systems.

### Built With Modern AI Infrastructure

Motif showcases the power of modern AI development tools:

- **v0** - Primary development platform for rapid UI and feature iteration
- **▲ Vercel AI SDK 6** - Powers multi-model AI integration (Claude, GPT-4, Gemini, Flux)
- **AI Gateway** - Intelligent routing and management of AI model requests
- **Next.js 16** - App Router with React Server Components
- **Tailwind CSS v4** - Modern utility-first styling with design tokens

### About Webrenew

[Webrenew](https://webrenew.com) is a digital agency specializing in modern web development, AI integration, and design systems. We build tools that enhance designer and developer productivity.

This repository is automatically synced with deployed chats on [v0.app](https://v0.app). Changes made to your deployed app are automatically pushed to this repository.

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

- **Upstash Redis** - For rate limiting
- **Supabase** - For database and storage
- **Postgres** - Database connection (provided by Supabase)

See [`.env.example`](.env.example) for the complete list of required environment variables.

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

## How It Works

1. Create and modify your project using [v0.app](https://v0.app)
2. Deploy your chats from the v0 interface
3. Changes are automatically pushed to this repository
4. Vercel deploys the latest version from this repository

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

## License

This project is licensed under the Apache License 2.0 - see the [LICENSE](LICENSE) file for details.

**What this means:**
- Free to use, modify, and distribute
- Can be used commercially
- Can create derivative works
- Must include a copy of the license
- Must state significant changes made
- Must preserve copyright and attribution notices
- Does NOT require you to open-source derivative works (permissive license)