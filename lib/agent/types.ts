/**
 * Agent Types
 * 
 * Shared types for agent tools and bridge communication.
 */

export type NodeType = 
  | 'imageNode' 
  | 'promptNode' 
  | 'codeNode' 
  | 'textInputNode' 
  | 'stickyNoteNode' 
  | 'captureNode'

export type Position = { x: number; y: number }

// Tool result types
export interface CreateNodeResult {
  success: true
  nodeId: string
  nodeType: NodeType
  position: Position
  data: Record<string, unknown>
}

export interface ConnectNodesResult {
  success: true
  edgeId: string
  sourceId: string
  targetId: string
}

export interface DeleteNodeResult {
  success: true
  deletedNodeIds: string[]
  deletedEdgeIds: string[]
}

export interface ExecuteWorkflowResult {
  success: boolean
  status: "executed" | "awaiting_confirmation" | "cancelled"
  message: string
}

export interface ToolError {
  success: false
  error: string
}

// Canvas state for getCanvasState tool
export interface CanvasState {
  nodes: Array<{
    id: string
    type: string
    position: Position
    data: Record<string, unknown>
  }>
  edges: Array<{
    id: string
    source: string
    target: string
  }>
}
