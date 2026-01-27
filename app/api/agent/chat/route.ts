import { streamText, stepCountIs, convertToModelMessages } from "ai"
import { workflowTools } from "@/lib/agent/tools"
import { checkAgentRateLimit } from "@/lib/rate-limit"
import { getAuthenticatedUser } from "@/lib/supabase/edge-auth"
import { createLogger } from "@/lib/logger"

export const runtime = "edge"

const logger = createLogger("agent-chat")

const SYSTEM_PROMPT = `You are Motif's workflow assistant. You help users with design and coding tasks.

## When to Use Tools vs Chat

**Respond in chat (no tools) for:**
- General coding questions ("create a button component", "write a function")
- Explanations or advice
- Questions about how things work
- Simple requests that don't need visual workflows

**Use workflow tools ONLY when the user explicitly:**
- Says "create a workflow", "add to canvas", "build a pipeline"
- Asks for image generation (which requires the visual workflow)
- Wants to connect multiple AI operations together
- References the canvas or nodes directly

## CRITICAL: Canvas Modification Rules

**Before modifying the canvas, ALWAYS ask the user first:**
1. If canvas has existing nodes: "I see you have an existing workflow. Would you like me to add to it or clear it first?"
2. If creating multiple nodes: Briefly describe what you plan to create and ask for confirmation
3. Never silently create/delete nodes without user acknowledgment

**Exception:** You may proceed without asking if the user explicitly says "add", "create on canvas", or similar direct commands.

## Your Tools (use sparingly)
- **createNode**: Create nodes on the canvas
- **connectNodes**: Connect nodes to form pipelines
- **deleteNode**: Remove nodes
- **executeWorkflow**: Run the workflow (ask confirmation first)
- **getCanvasState**: Query current canvas state

## Interaction Style
- Be helpful and conversational
- For coding questions, respond with code directly in chat
- Only create workflow nodes when explicitly requested
- Keep responses concise
- Never output undefined values or placeholder variables

## Node Types (when creating workflows)
1. **imageNode**: Image input/output
2. **promptNode**: AI operations (outputType: "image" or "text")
3. **codeNode**: Code display
4. **textInputNode**: Text input field
5. **stickyNoteNode**: Annotations
6. **captureNode**: Animation capture

## Workflow Patterns (when explicitly requested)
- **Image generation**: imageNode → promptNode → imageNode
- **Code generation**: imageNode → promptNode → codeNode

## Important
- Default to chatting normally - workflows are for complex multi-step AI pipelines
- For simple "create X" requests, just write the code in your response
- Only use tools when the user specifically wants canvas manipulation`

export async function POST(req: Request) {
  try {
    // Check authentication first - this feature requires a signed-in user
    const user = await getAuthenticatedUser()
    
    if (!user) {
      return new Response(
        JSON.stringify({ error: "Sign in required to use the workflow agent" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      )
    }

    // Check rate limit (Opus is expensive) - pass email for exemptions
    const rateLimit = await checkAgentRateLimit(user.email ?? undefined)
    
    if (!rateLimit.success) {
      if ("error" in rateLimit) {
        logger.error("Rate limit configuration error", { error: rateLimit.error })
        return new Response(
          JSON.stringify({ error: rateLimit.error }),
          { status: 503, headers: { "Content-Type": "application/json" } }
        )
      }
      
      const resetDate = new Date(rateLimit.reset)
      const message = rateLimit.limitType === "user"
        ? `You've reached your message limit (${rateLimit.limit}/hour). Try again ${resetDate.toLocaleTimeString()}.`
        : "The service is experiencing high demand. Please try again later."
      
      logger.warn("Rate limit exceeded", { 
        limitType: rateLimit.limitType,
        limit: rateLimit.limit,
        reset: rateLimit.reset 
      })
      
      return new Response(
        JSON.stringify({ 
          error: message,
          rateLimit: {
            limit: rateLimit.limit,
            remaining: rateLimit.remaining,
            reset: rateLimit.reset,
            limitType: rateLimit.limitType,
          }
        }),
        { 
          status: 429, 
          headers: { 
            "Content-Type": "application/json",
            "X-RateLimit-Limit": String(rateLimit.limit),
            "X-RateLimit-Remaining": String(rateLimit.remaining),
            "X-RateLimit-Reset": String(rateLimit.reset),
          } 
        }
      )
    }
    
    const { messages } = await req.json()

    // Convert UI messages (with parts) to model messages (with content)
    const modelMessages = await convertToModelMessages(messages)

    const result = streamText({
      model: "anthropic/claude-opus-4-5" as Parameters<typeof streamText>[0]["model"],
      system: SYSTEM_PROMPT,
      messages: modelMessages,
      tools: workflowTools,
      stopWhen: stepCountIs(10), // Allow up to 10 steps for building workflows
    })

    return result.toUIMessageStreamResponse()
  } catch (error) {
    console.error("Agent chat error:", error)
    return new Response(
      JSON.stringify({ error: "Failed to process chat message" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    )
  }
}
