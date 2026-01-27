/**
 * Agent Bridge
 * 
 * Communication layer between the agent chat and the workflow canvas.
 * Uses a custom event-based system to dispatch tool results from the API
 * to the canvas for execution.
 */

import type { 
  NodeType, 
  Position, 
  CreateNodeResult, 
  ConnectNodesResult, 
  DeleteNodeResult,
  ExecuteWorkflowResult,
} from "./types"

// Event types for agent-canvas communication
export const AGENT_EVENTS = {
  CREATE_NODE: "agent:createNode",
  CONNECT_NODES: "agent:connectNodes", 
  DELETE_NODE: "agent:deleteNode",
  EXECUTE_WORKFLOW: "agent:executeWorkflow",
  GET_STATE: "agent:getState",
  STATE_RESPONSE: "agent:stateResponse",
} as const

// Payload types for events
export interface CreateNodeEventDetail {
  nodeId: string
  nodeType: NodeType
  position: Position
  data: Record<string, unknown>
}

export interface ConnectNodesEventDetail {
  edgeId: string
  sourceId: string
  targetId: string
  sourceHandle?: string
  targetHandle?: string
}

export interface DeleteNodeEventDetail {
  nodeIds: string[]
}

export interface ExecuteWorkflowEventDetail {
  confirmed: boolean
}

export interface StateResponseEventDetail {
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

/**
 * Dispatch a createNode action to the canvas
 */
export function dispatchCreateNode(detail: CreateNodeEventDetail): void {
  window.dispatchEvent(
    new CustomEvent(AGENT_EVENTS.CREATE_NODE, { detail })
  )
}

/**
 * Dispatch a connectNodes action to the canvas
 */
export function dispatchConnectNodes(detail: ConnectNodesEventDetail): void {
  window.dispatchEvent(
    new CustomEvent(AGENT_EVENTS.CONNECT_NODES, { detail })
  )
}

/**
 * Dispatch a deleteNode action to the canvas
 */
export function dispatchDeleteNode(detail: DeleteNodeEventDetail): void {
  window.dispatchEvent(
    new CustomEvent(AGENT_EVENTS.DELETE_NODE, { detail })
  )
}

/**
 * Dispatch an executeWorkflow action to the canvas
 */
export function dispatchExecuteWorkflow(detail: ExecuteWorkflowEventDetail): void {
  window.dispatchEvent(
    new CustomEvent(AGENT_EVENTS.EXECUTE_WORKFLOW, { detail })
  )
}

/**
 * Request current canvas state
 * Returns a promise that resolves with the canvas state
 */
export function requestCanvasState(): Promise<StateResponseEventDetail> {
  return new Promise((resolve) => {
    const handler = (event: Event) => {
      const customEvent = event as CustomEvent<StateResponseEventDetail>
      window.removeEventListener(AGENT_EVENTS.STATE_RESPONSE, handler)
      resolve(customEvent.detail)
    }
    
    window.addEventListener(AGENT_EVENTS.STATE_RESPONSE, handler)
    window.dispatchEvent(new CustomEvent(AGENT_EVENTS.GET_STATE))
    
    // Timeout after 5 seconds
    setTimeout(() => {
      window.removeEventListener(AGENT_EVENTS.STATE_RESPONSE, handler)
      resolve({ nodes: [], edges: [] })
    }, 5000)
  })
}

/**
 * Process a tool result and dispatch the appropriate action
 */
export function processToolResult(
  toolName: string,
  result: CreateNodeResult | ConnectNodesResult | DeleteNodeResult | ExecuteWorkflowResult | { success: false; error: string }
): void {
  if (!result.success) {
    console.error(`Tool ${toolName} failed:`, (result as { error: string }).error)
    return
  }

  switch (toolName) {
    case "createNode": {
      const createResult = result as CreateNodeResult & { data: Record<string, unknown> }
      dispatchCreateNode({
        nodeId: createResult.nodeId,
        nodeType: createResult.nodeType,
        position: createResult.position,
        data: createResult.data || {},
      })
      break
    }
    
    case "connectNodes": {
      const connectResult = result as ConnectNodesResult & { 
        sourceHandle?: string
        targetHandle?: string 
      }
      dispatchConnectNodes({
        edgeId: connectResult.edgeId,
        sourceId: connectResult.sourceId,
        targetId: connectResult.targetId,
        sourceHandle: connectResult.sourceHandle,
        targetHandle: connectResult.targetHandle,
      })
      break
    }
    
    case "deleteNode": {
      const deleteResult = result as DeleteNodeResult
      dispatchDeleteNode({
        nodeIds: deleteResult.deletedNodeIds,
      })
      break
    }
    
    case "executeWorkflow": {
      const executeResult = result as ExecuteWorkflowResult
      // Only dispatch execution when confirmed
      if (executeResult.status === "executed") {
        dispatchExecuteWorkflow({
          confirmed: true,
        })
      }
      break
    }
  }
}

/**
 * Hook to set up canvas listeners for agent events
 * Call this in the workflow canvas component
 */
export type AgentBridgeHandlers = {
  onCreateNode: (detail: CreateNodeEventDetail) => void
  onConnectNodes: (detail: ConnectNodesEventDetail) => void
  onDeleteNode: (detail: DeleteNodeEventDetail) => void
  onExecuteWorkflow: (detail: ExecuteWorkflowEventDetail) => void
  onGetState: () => StateResponseEventDetail
}

export function setupAgentBridgeListeners(handlers: AgentBridgeHandlers): () => void {
  const createHandler = (event: Event) => {
    const customEvent = event as CustomEvent<CreateNodeEventDetail>
    handlers.onCreateNode(customEvent.detail)
  }
  
  const connectHandler = (event: Event) => {
    const customEvent = event as CustomEvent<ConnectNodesEventDetail>
    handlers.onConnectNodes(customEvent.detail)
  }
  
  const deleteHandler = (event: Event) => {
    const customEvent = event as CustomEvent<DeleteNodeEventDetail>
    handlers.onDeleteNode(customEvent.detail)
  }
  
  const executeHandler = (event: Event) => {
    const customEvent = event as CustomEvent<ExecuteWorkflowEventDetail>
    handlers.onExecuteWorkflow(customEvent.detail)
  }
  
  const stateHandler = () => {
    const state = handlers.onGetState()
    window.dispatchEvent(
      new CustomEvent(AGENT_EVENTS.STATE_RESPONSE, { detail: state })
    )
  }
  
  window.addEventListener(AGENT_EVENTS.CREATE_NODE, createHandler)
  window.addEventListener(AGENT_EVENTS.CONNECT_NODES, connectHandler)
  window.addEventListener(AGENT_EVENTS.DELETE_NODE, deleteHandler)
  window.addEventListener(AGENT_EVENTS.EXECUTE_WORKFLOW, executeHandler)
  window.addEventListener(AGENT_EVENTS.GET_STATE, stateHandler)
  
  // Return cleanup function
  return () => {
    window.removeEventListener(AGENT_EVENTS.CREATE_NODE, createHandler)
    window.removeEventListener(AGENT_EVENTS.CONNECT_NODES, connectHandler)
    window.removeEventListener(AGENT_EVENTS.DELETE_NODE, deleteHandler)
    window.removeEventListener(AGENT_EVENTS.EXECUTE_WORKFLOW, executeHandler)
    window.removeEventListener(AGENT_EVENTS.GET_STATE, stateHandler)
  }
}
