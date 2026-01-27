import { generateText } from "ai"
import { getAuthenticatedUser } from "@/lib/supabase/edge-auth"
import { createLogger } from "@/lib/logger"

export const runtime = "edge"

const logger = createLogger("workflow-autoname")

export async function POST(request: Request) {
  try {
    // Verify authentication
    const user = await getAuthenticatedUser()
    if (!user) {
      return new Response(
        JSON.stringify({ error: "Authentication required" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      )
    }

    const body = await request.json()
    const { nodes } = body

    if (!nodes || !Array.isArray(nodes)) {
      return new Response(
        JSON.stringify({ error: "nodes array required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      )
    }

    // Extract relevant content from nodes for naming
    const nodeDescriptions: string[] = []
    
    for (const node of nodes) {
      if (node.type === "promptNode" && node.data?.prompt) {
        nodeDescriptions.push(`Prompt: ${node.data.prompt.slice(0, 200)}`)
      }
      if (node.type === "imageNode" && node.data?.label) {
        nodeDescriptions.push(`Image: ${node.data.label}`)
      }
      if (node.type === "textInputNode" && node.data?.value) {
        nodeDescriptions.push(`Input: ${node.data.value.slice(0, 100)}`)
      }
      if (node.type === "codeNode" && node.data?.label) {
        nodeDescriptions.push(`Code: ${node.data.label}`)
      }
    }

    if (nodeDescriptions.length === 0) {
      return new Response(
        JSON.stringify({ name: "Untitled Workflow" }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    }

    const context = nodeDescriptions.slice(0, 5).join("\n")

    // Use a fast, cheap model for naming
    const result = await generateText({
      model: "anthropic/claude-haiku-4.5" as Parameters<typeof generateText>[0]["model"],
      prompt: `Generate a short, descriptive name (3-6 words max) for a design workflow with these elements:

${context}

Respond with ONLY the name, nothing else. No quotes, no explanation.`,
    })

    const name = result.text.trim().slice(0, 50) || "Untitled Workflow"

    logger.info("Generated workflow name", { 
      userId: user.id.slice(0, 8) + "...",
      name,
      nodeCount: nodes.length,
    })

    return new Response(
      JSON.stringify({ name }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    )
  } catch (error) {
    logger.error("Failed to generate workflow name", {
      error: error instanceof Error ? error.message : String(error),
    })
    
    return new Response(
      JSON.stringify({ name: "Untitled Workflow" }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    )
  }
}
