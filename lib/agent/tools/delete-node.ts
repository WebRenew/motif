/**
 * Delete Node Tool
 * 
 * AI SDK tool for deleting nodes from the workflow canvas.
 * Also removes any connected edges.
 */

import { z } from 'zod'
import type { DeleteNodeResult, ToolError } from '../types'

// Schema for the tool parameters
export const deleteNodeSchema = z.object({
  nodeIds: z.array(z.string()).min(1).describe('Array of node IDs to delete'),
})

export type DeleteNodeParams = z.infer<typeof deleteNodeSchema>

/**
 * Execute the deleteNode tool
 * Returns a result for the client to execute via the bridge
 */
export async function executeDeleteNode(
  params: DeleteNodeParams
): Promise<DeleteNodeResult | ToolError> {
  const { nodeIds } = params
  
  if (!nodeIds || nodeIds.length === 0) {
    return {
      success: false,
      error: 'At least one node ID is required',
    }
  }
  
  // Validate node IDs format (basic sanity check)
  for (const nodeId of nodeIds) {
    if (typeof nodeId !== 'string' || nodeId.trim() === '') {
      return {
        success: false,
        error: `Invalid node ID: ${nodeId}`,
      }
    }
  }
  
  // Return the action for client-side execution
  // The actual deletion and edge cleanup happens on the client
  return {
    success: true,
    deletedNodeIds: nodeIds,
    deletedEdgeIds: [], // Will be populated by client after deletion
  }
}

/**
 * Tool description for the AI model
 */
export const deleteNodeDescription = `Delete one or more nodes from the workflow canvas.

Behavior:
- Deleting a node also removes all edges connected to it
- Can delete multiple nodes at once by providing an array of IDs
- Use this to clean up workflows or remove unwanted nodes

Caution:
- Always confirm with the user before deleting nodes with content (images, code, prompts)
- Deletion cannot be undone through this tool (user can use Cmd+Z to undo)

Usage tips:
- Get current canvas state first to verify node IDs
- Prefer deleting unused nodes to keep workflows clean`
