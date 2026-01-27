/**
 * Get Canvas State Tool
 *
 * Allows the agent to see current nodes and edges on the canvas.
 * Essential for verifying node IDs before connecting or modifying.
 */

import { z } from "zod"

// Schema for the tool parameters (no parameters needed)
export const getCanvasStateSchema = z.object({})

export type GetCanvasStateParams = z.infer<typeof getCanvasStateSchema>

export interface CanvasStateResult {
  success: true
  nodes: Array<{
    id: string
    type: string
    position: { x: number; y: number }
    data: Record<string, unknown>
  }>
  edges: Array<{
    id: string
    source: string
    target: string
  }>
  summary: string
}

/**
 * Execute the getCanvasState tool
 * Returns a marker that the client will intercept and respond to
 */
export async function executeGetCanvasState(): Promise<CanvasStateResult> {
  // This returns a pending state - the actual state comes from the client
  // The bridge will intercept this and provide real canvas state
  return {
    success: true,
    nodes: [],
    edges: [],
    summary: "Requesting canvas state from client...",
  }
}

/**
 * Tool description for the AI model
 */
export const getCanvasStateDescription = `Get the current state of the workflow canvas.

Returns:
- List of all nodes with their IDs, types, positions, and data
- List of all edges showing connections between nodes
- A summary of the current workflow

Use this tool to:
- Verify node IDs exist before connecting them
- Understand the current workflow structure before making changes
- Check if a workflow is empty before creating nodes
- Avoid creating duplicate nodes

Always call this tool before:
- Connecting nodes (to verify IDs)
- Deleting nodes (to confirm what will be deleted)
- Building on existing workflows`
