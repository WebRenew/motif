# Agent-Powered Workflow Creation

> **Vision**: Users just want to get shit done. Give them an agent that builds workflows for them.

## Overview

Add an Intercom-style chat widget that lets users describe what they want in natural language. The agent creates, modifies, and executes workflows on their behalf with a confirm-before-execute pattern.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Chat Widget (UI)                        │
│  - Floating Intercom-style interface                        │
│  - Message history, typing indicators                       │
│  - Workflow preview cards                                   │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                  /api/agent/chat (Backend)                   │
│  - Vercel AI SDK with tool calling                          │
│  - Streaming responses                                      │
│  - Session management                                       │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Agent Tools                               │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────────────┐    │
│  │ createNode  │ │ connectNodes│ │ executeWorkflow     │    │
│  └─────────────┘ └─────────────┘ └─────────────────────┘    │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────────────┐    │
│  │ deleteNode  │ │ updateNode  │ │ getWorkflowState    │    │
│  └─────────────┘ └─────────────┘ └─────────────────────┘    │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────────────┐    │
│  │ listNodes   │ │ clearCanvas │ │ searchUserHistory   │    │
│  └─────────────┘ └─────────────┘ └─────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                 Memory & Context (Supabase)                  │
│  - Conversation history (agent_conversations)               │
│  - Vector embeddings for semantic search (vecs schema)      │
│  - Workflow templates learned from user patterns            │
└─────────────────────────────────────────────────────────────┘
```

## User Experience Flow

### Happy Path: Image Generation Pipeline

```
User: "I want to generate 5 logo variations from this sketch"

Agent: I'll create a workflow for you:
       ┌──────────┐     ┌──────────────┐     ┌──────────┐
       │  Image   │────▶│   Prompt     │────▶│  Output  │
       │  Input   │     │ "5 variations│     │  Grid    │
       └──────────┘     │  of logo..." │     └──────────┘
       
       [Preview Workflow] [Execute] [Modify]

User: *clicks Execute*

Agent: Workflow running... Generated 5 variations.
       [View Results] [Save as Template]
```

### Modification Flow

```
User: "Actually, make it 10 variations and add a style transfer step"

Agent: Updated workflow:
       ┌──────────┐     ┌──────────────┐     ┌──────────┐     ┌──────────┐
       │  Image   │────▶│   Style      │────▶│  Prompt  │────▶│  Output  │
       │  Input   │     │  Transfer    │     │ "10 var..│     │  Grid    │
       └──────────┘     └──────────────┘     └──────────┘     └──────────┘
       
       [Execute Changes] [Undo]
```

## Technical Implementation

### Phase 1: Core Agent Infrastructure

#### 1.1 Chat Widget Component
```
components/agent/
├── agent-chat.tsx           # Main chat container
├── chat-message.tsx         # Message bubbles (user/agent)
├── chat-input.tsx           # Input with send button
├── workflow-preview.tsx     # Inline workflow visualization
└── action-buttons.tsx       # Execute/Modify/Undo buttons
```

**Key features:**
- Floating button (bottom-right) that expands to chat
- Minimizable/maximizable states
- Keyboard shortcut (Cmd+K) to open
- Dark mode support

#### 1.2 API Route
```typescript
// app/api/agent/chat/route.ts
import { streamText, tool } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { z } from 'zod';

const workflowTools = {
  createNode: tool({
    description: 'Create a new node on the workflow canvas',
    parameters: z.object({
      type: z.enum(['imageNode', 'promptNode', 'codeNode']),
      position: z.object({ x: z.number(), y: z.number() }).optional(),
      data: z.record(z.any()).optional(),
    }),
    execute: async ({ type, position, data }) => {
      // Returns node ID, broadcasts to canvas via SSE/websocket
    },
  }),
  
  connectNodes: tool({
    description: 'Connect two nodes with an edge',
    parameters: z.object({
      sourceId: z.string(),
      targetId: z.string(),
      sourceHandle: z.string().optional(),
      targetHandle: z.string().optional(),
    }),
    execute: async ({ sourceId, targetId }) => {
      // Creates edge, returns edge ID
    },
  }),
  
  executeWorkflow: tool({
    description: 'Execute the current workflow',
    parameters: z.object({
      confirm: z.boolean().describe('User must confirm before execution'),
    }),
    execute: async ({ confirm }) => {
      if (!confirm) return { status: 'awaiting_confirmation' };
      // Triggers workflow execution
    },
  }),
  
  // ... more tools
};
```

#### 1.3 Real-time Canvas Sync

The agent needs to manipulate the canvas in real-time. Options:

| Approach | Pros | Cons |
|----------|------|------|
| **Zustand store actions** | Simple, already in use | Requires client-side execution |
| **Server-sent events** | Real-time, server-controlled | More complexity |
| **Broadcast channel** | Works across tabs | Browser-only |

**Recommendation:** Expose Zustand actions via a `useAgentBridge` hook that the API calls through a message channel.

```typescript
// lib/agent/bridge.ts
export function useAgentBridge() {
  const { addNode, addEdge, removeNode } = useWorkflowStore();
  
  useEffect(() => {
    const channel = new BroadcastChannel('agent-commands');
    channel.onmessage = (event) => {
      const { action, payload } = event.data;
      switch (action) {
        case 'ADD_NODE': addNode(payload); break;
        case 'ADD_EDGE': addEdge(payload); break;
        // ...
      }
    };
    return () => channel.close();
  }, []);
}
```

### Phase 2: Memory & Learning

#### 2.1 Database Schema

```sql
-- Conversation history
CREATE TABLE agent_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  workflow_id UUID REFERENCES workflows(id),
  messages JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Vector store for semantic search (using Supabase vecs)
-- Stores: workflow descriptions, user intents, successful patterns
CREATE TABLE agent_memory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  content TEXT NOT NULL,
  embedding vector(1536),  -- OpenAI ada-002 dimensions
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for similarity search
CREATE INDEX agent_memory_embedding_idx ON agent_memory 
USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
```

#### 2.2 Supabase Vecs Integration

Supabase has a Python SDK (`vecs`) for vector operations, but we can use raw SQL from the JS client:

```typescript
// lib/agent/memory.ts
import { createClient } from '@supabase/supabase-js';

export async function storeMemory(userId: string, content: string, metadata: object) {
  const embedding = await generateEmbedding(content); // OpenAI API
  
  await supabase.from('agent_memory').insert({
    user_id: userId,
    content,
    embedding,
    metadata,
  });
}

export async function searchMemory(userId: string, query: string, limit = 5) {
  const queryEmbedding = await generateEmbedding(query);
  
  const { data } = await supabase.rpc('match_agent_memory', {
    query_embedding: queryEmbedding,
    match_threshold: 0.7,
    match_count: limit,
    filter_user_id: userId,
  });
  
  return data;
}
```

#### 2.3 What Gets Memorized

| Event | Stored As | Use Case |
|-------|-----------|----------|
| Successful workflow execution | Workflow template + intent | "Do that logo thing again" |
| User corrections | Preference pattern | Learn user style |
| Frequent node combinations | Workflow snippet | Suggest completions |
| Error resolutions | Problem/solution pair | Avoid repeating mistakes |

### Phase 3: Advanced Features

#### 3.1 Workflow Templates

When a workflow executes successfully, offer to save as template:

```typescript
interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;  // Agent-generated
  nodes: SerializedNode[];
  edges: SerializedEdge[];
  variables: TemplateVariable[];  // Parameterized inputs
  user_id: string;
  is_public: boolean;
  usage_count: number;
}
```

#### 3.2 Smart Suggestions

Based on memory, the agent can proactively suggest:

```
Agent: I noticed you often start with an image upload and 
       style transfer. Want me to set that up?
       
       [Yes, create it] [No thanks] [Always do this]
```

#### 3.3 Multi-step Execution with Checkpoints

For complex workflows, execute in stages:

```
Agent: This workflow has 4 stages. I'll pause after each 
       for your review:
       
       Stage 1: Image preprocessing ✓
       Stage 2: Style transfer [Running...]
       Stage 3: Variation generation [Pending]
       Stage 4: Export to grid [Pending]
       
       [Continue] [Modify Stage 2] [Cancel]
```

## Agent System Prompt

```markdown
You are Motif's workflow assistant. You help users create and execute 
visual workflows for design tasks.

## Your Capabilities
- Create nodes (image inputs, AI prompts, code outputs)
- Connect nodes to form processing pipelines
- Execute workflows and explain results
- Remember user preferences and past workflows

## Interaction Style
- Be concise and action-oriented
- Show workflow previews before execution
- Always confirm before running workflows
- Explain what each node does when asked

## Available Node Types
1. **imageNode**: Upload or receive images
2. **promptNode**: AI operations (generation, editing, analysis)
3. **codeNode**: Generate code (React, CSS, JSON, etc.)

## Workflow Patterns You Know
- Image → Prompt → Output (basic generation)
- Image → Style Transfer → Variations → Grid (style exploration)
- Sketch → Code Generation → Preview (design-to-code)

When users describe what they want, map it to these patterns and 
suggest the appropriate workflow structure.
```

## Implementation Phases

### Phase 1: MVP (2 weeks)
- [x] Chat widget UI (floating button, message list, input)
- [x] Basic API route with streaming (Claude Opus 4.5 via AI Gateway)
- [ ] Add rate limiting to `/api/agent/chat` (consider separate limit from image gen, e.g., 20 msgs/hour - Opus is expensive)
- [ ] Core tools: createNode, connectNodes, deleteNode
- [ ] executeWorkflow with confirmation
- [ ] Canvas bridge for real-time updates

### Phase 2: Memory (1 week)
- [ ] Conversation persistence in Supabase
- [ ] Vector store setup for semantic search
- [ ] Basic memory retrieval in system prompt
- [ ] "Remember this" explicit save

### Phase 3: Intelligence (2 weeks)
- [ ] Workflow template system
- [ ] Pattern learning from successful executions
- [ ] Proactive suggestions
- [ ] Multi-step execution with checkpoints

### Phase 4: Polish (1 week)
- [ ] Keyboard shortcuts (Cmd+K to open, etc.)
- [ ] Workflow preview cards in chat
- [ ] Undo/redo for agent actions
- [ ] Error recovery suggestions

## File Structure

```
app/
├── api/
│   └── agent/
│       ├── chat/
│       │   └── route.ts          # Main streaming endpoint
│       └── memory/
│           └── route.ts          # Memory search endpoint
│
components/
├── agent/
│   ├── agent-chat.tsx            # Main container
│   ├── agent-button.tsx          # Floating trigger button
│   ├── chat-message.tsx          # Message bubbles
│   ├── chat-input.tsx            # Input field
│   ├── workflow-preview.tsx      # Inline workflow viz
│   └── action-buttons.tsx        # Execute/Modify/etc
│
lib/
├── agent/
│   ├── tools/
│   │   ├── create-node.ts
│   │   ├── connect-nodes.ts
│   │   ├── execute-workflow.ts
│   │   ├── update-node.ts
│   │   ├── delete-node.ts
│   │   └── index.ts              # Tool registry
│   ├── memory.ts                 # Vector store operations
│   ├── bridge.ts                 # Canvas communication
│   └── prompts.ts                # System prompts
│
supabase/
└── migrations/
    └── YYYYMMDD_agent_tables.sql # New tables
```

## Dependencies to Add

```bash
# Already have Vercel AI SDK, just need:
pnpm add @ai-sdk/anthropic  # If using Claude (recommended for tool use)
# OR stick with existing OpenAI setup

# For embeddings (if not using OpenAI)
pnpm add @xenova/transformers  # Local embeddings alternative
```

## Open Questions

1. ~~**Model choice**: Claude Sonnet vs GPT-4o for tool calling?~~ **Decided: Claude Opus 4.5 via Vercel AI Gateway**

2. **Canvas state sync**: Should agent tools directly mutate Zustand, or go through the same API the UI uses?

3. **Rate limiting**: Should agent actions count against user's generation limits?
   - Current limits: 6 req/hour (user), 200 req/hour (global) for image generation
   - Agent chat has NO rate limiting yet - needs to be added
   - Consider: separate agent limit (e.g., 20 msgs/hour) vs shared pool

4. **Offline support**: Cache conversation locally for when connection drops?

## Success Metrics

- **Adoption**: % of users who try the agent
- **Completion rate**: % of agent-created workflows that execute successfully
- **Time savings**: Compare workflow creation time (manual vs agent)
- **Retention**: Do agent users come back more often?

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Agent creates invalid workflows | Validate before preview, show clear errors |
| Runaway API costs | Rate limit agent calls, cache similar queries |
| Users expect too much | Clear capability boundaries in onboarding |
| Slow response times | Stream everything, show typing indicators |

---

*Last updated: January 2026*
