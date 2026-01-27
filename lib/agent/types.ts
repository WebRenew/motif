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

// Bridge action types for client-side execution
export type AgentAction =
  | { type: 'CREATE_NODE'; payload: CreateNodePayload }
  | { type: 'CONNECT_NODES'; payload: ConnectNodesPayload }
  | { type: 'DELETE_NODE'; payload: DeleteNodePayload }
  | { type: 'UPDATE_NODE'; payload: UpdateNodePayload }
  | { type: 'GET_CANVAS_STATE' }

export interface CreateNodePayload {
  nodeType: NodeType
  position?: Position
  data?: Record<string, unknown>
}

export interface ConnectNodesPayload {
  sourceId: string
  targetId: string
  sourceHandle?: string
  targetHandle?: string
}

export interface DeleteNodePayload {
  nodeId: string
}

export interface UpdateNodePayload {
  nodeId: string
  data: Record<string, unknown>
}

// Canvas state returned by GET_CANVAS_STATE
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
