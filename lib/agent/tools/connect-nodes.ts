/**
 * Connect Nodes Tool
 * 
 * AI SDK tool for connecting two nodes with an edge.
 * Validates connections based on workflow rules.
 */

import { z } from 'zod'
import type { ConnectNodesResult, ToolError } from '../types'

// Schema for the tool parameters
export const connectNodesSchema = z.object({
  sourceId: z.string().describe('ID of the source node (where the connection starts)'),
  targetId: z.string().describe('ID of the target node (where the connection ends)'),
  sourceHandle: z.string().optional().describe('Optional handle ID on the source node'),
  targetHandle: z.string().optional().describe('Optional handle ID on the target node'),
})

export type ConnectNodesParams = z.infer<typeof connectNodesSchema>

/**
 * Execute the connectNodes tool
 * Returns a result for the client to execute via the bridge
 * 
 * Note: Full validation happens client-side where we have access to all nodes/edges.
 * This tool returns the connection request with basic validation.
 */
export async function executeConnectNodes(
  params: ConnectNodesParams
): Promise<ConnectNodesResult | ToolError> {
  const { sourceId, targetId, sourceHandle, targetHandle } = params
  
  // Basic validation
  if (sourceId === targetId) {
    return {
      success: false,
      error: 'Cannot connect a node to itself',
    }
  }
  
  if (!sourceId || !targetId) {
    return {
      success: false,
      error: 'Both source and target node IDs are required',
    }
  }
  
  // Generate edge ID
  const edgeId = `e-${sourceId}-${targetId}`
  
  return {
    success: true,
    edgeId,
    sourceId,
    targetId,
    // Include handles for client-side edge creation
    ...({ sourceHandle, targetHandle } as Record<string, unknown>),
  } as ConnectNodesResult & { sourceHandle?: string; targetHandle?: string }
}

/**
 * Tool description for the AI model
 */
export const connectNodesDescription = `Connect two nodes with an edge to create data flow.

Connection rules:
- Data flows left-to-right: source → target
- Image/Code/TextInput/Capture nodes can only connect TO prompt nodes
- Prompt nodes output to Image nodes (for images) or Code nodes (for text)
- Prompt nodes can have multiple inputs but only one code output
- Cannot connect output nodes directly to each other (image→image, code→code)

Common patterns:
1. imageNode → promptNode: Feed an image into an AI prompt
2. promptNode → imageNode: Receive generated image output
3. promptNode → codeNode: Receive generated code output
4. Multiple imageNodes → promptNode: Combine multiple images as input

Always verify node IDs exist before connecting.`
