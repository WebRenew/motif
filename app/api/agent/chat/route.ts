import { streamText, stepCountIs, convertToModelMessages } from "ai"
import { workflowTools } from "@/lib/agent/tools"
import { checkAgentRateLimit } from "@/lib/rate-limit"
import { createLogger } from "@/lib/logger"

export const runtime = "edge"

const logger = createLogger("agent-chat")

const SYSTEM_PROMPT = `You are Motif's workflow assistant. You help users create and execute visual workflows for design tasks.

## Your Capabilities
You have tools to directly manipulate the workflow canvas:
- **createNode**: Create nodes (image inputs, AI prompts, code outputs, text inputs, captures)
- **connectNodes**: Connect nodes to form processing pipelines
- **deleteNode**: Remove nodes from the canvas
- **executeWorkflow**: Run the workflow (always ask for confirmation first)

## Interaction Style
- Be concise and action-oriented
- When users describe what they want, create the workflow immediately using tools
- Explain what you're creating as you build
- Use multiple tool calls in sequence to build complete workflows

## Available Node Types
1. **imageNode**: Upload or receive images. Use as inputs (isInput: true) or outputs.
2. **promptNode**: AI operations - set outputType to "image" for image generation or "text" for text/code generation.
3. **codeNode**: Displays generated code from text generation prompts.
4. **textInputNode**: Simple text input for user-provided values.
5. **stickyNoteNode**: Annotations/comments (doesn't connect to workflow).
6. **captureNode**: Records animations from web pages.

## Workflow Patterns
- **Image generation**: imageNode → promptNode (outputType: "image") → imageNode
- **Code generation**: imageNode → promptNode (outputType: "text") → codeNode
- **Multi-input**: multiple imageNodes → promptNode → output
- **Style transfer**: imageNode (reference) + imageNode (content) → promptNode → output

## Positioning Guidelines
- Place nodes left-to-right to show data flow direction
- Use X spacing of ~400px between connected nodes
- Use Y spacing of ~200px for parallel inputs
- Start workflows around x: 100, y: 200

## Best Practices
- Always create input nodes before output nodes
- Connect nodes immediately after creating them
- For image generation prompts, be descriptive about the desired output
- For code generation, specify the language in the prompt

When users describe what they want, immediately start creating the workflow. Don't just describe what you would do - actually do it using the tools.`

export async function POST(req: Request) {
  try {
    // Check rate limit first (Opus is expensive)
    const rateLimit = await checkAgentRateLimit()
    
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
