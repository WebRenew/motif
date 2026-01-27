/**
 * Agent Bridge Hook
 * 
 * React hook to connect the workflow canvas to the agent chat.
 * Listens for agent events and executes canvas mutations.
 * 
 * Handles workflow ownership:
 * - If user owns workflow → modify in place
 * - If no workflow exists → create one first, then modify
 * - If demo mode → reject changes (read-only)
 */

import { useEffect, useCallback, useRef } from "react"
import type { Node, Edge } from "@xyflow/react"
import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime"
import {
  setupAgentBridgeListeners,
  type CreateNodeEventDetail,
  type ConnectNodesEventDetail,
  type DeleteNodeEventDetail,
  type ExecuteWorkflowEventDetail,
  type StateResponseEventDetail,
} from "@/lib/agent/bridge"
import { validateConnection } from "@/lib/workflow/connection-rules"
import { createWorkflow } from "@/lib/supabase/workflows"
import { toast } from "sonner"

type UseAgentBridgeOptions = {
  nodes: Node[]
  edges: Edge[]
  setNodes: (updater: Node[] | ((prev: Node[]) => Node[])) => void
  setEdges: (updater: Edge[] | ((prev: Edge[]) => Edge[])) => void
  pushToHistory: () => void
  debouncedSave: () => void
  runWorkflow: () => Promise<void>
  // Workflow context
  workflowIdRef: React.RefObject<string | null>
  userIdRef: React.RefObject<string | null>
  router?: AppRouterInstance
  demoMode?: boolean
}

/**
 * Hook to connect the workflow canvas to agent tool execution
 */
export function useAgentBridge({
  nodes,
  edges,
  setNodes,
  setEdges,
  pushToHistory,
  debouncedSave,
  runWorkflow,
  workflowIdRef,
  userIdRef,
  router,
  demoMode = false,
}: UseAgentBridgeOptions): void {
  
  // Track if we're currently creating a workflow to avoid race conditions
  const isCreatingWorkflowRef = useRef(false)
  
  /**
   * Ensure we have a valid workflow before executing agent actions.
   * Creates a new workflow if needed.
   */
  const ensureWorkflow = useCallback(async (): Promise<boolean> => {
    // Demo mode - reject all changes
    if (demoMode) {
      toast.error("Demo mode is read-only", {
        description: "Sign in to create and modify workflows with the agent.",
      })
      return false
    }
    
    // No user - can't create workflows
    if (!userIdRef.current) {
      toast.error("Not signed in", {
        description: "Sign in to use the workflow agent.",
      })
      return false
    }
    
    // Already have a workflow - good to go
    if (workflowIdRef.current) {
      return true
    }
    
    // Need to create a workflow first
    if (isCreatingWorkflowRef.current) {
      // Already creating - wait for it
      return false
    }
    
    isCreatingWorkflowRef.current = true
    
    try {
      toast.info("Creating workflow...", { duration: 2000 })
      
      const newWorkflowId = await createWorkflow(userIdRef.current, "Agent Workflow")
      
      if (!newWorkflowId) {
        toast.error("Failed to create workflow", {
          description: "Please try again or refresh the page.",
        })
        return false
      }
      
      // Update the ref (note: this is a ref, so it's mutable)
      // The actual workflowId.current is in the canvas component
      // We need to navigate to trigger the proper initialization
      if (router) {
        router.push(`/w/${newWorkflowId}`)
        toast.success("Workflow created!", {
          description: "Continue chatting with the agent.",
        })
      }
      
      return false // Return false since we're navigating
    } catch (error) {
      console.error("Failed to create workflow:", error)
      toast.error("Failed to create workflow")
      return false
    } finally {
      isCreatingWorkflowRef.current = false
    }
  }, [demoMode, userIdRef, workflowIdRef, router])
  
  // Handle node creation from agent
  const handleCreateNode = useCallback(async (detail: CreateNodeEventDetail) => {
    const canProceed = await ensureWorkflow()
    if (!canProceed) return
    
    const newNode: Node = {
      id: detail.nodeId,
      type: detail.nodeType,
      position: detail.position,
      data: detail.data,
    }
    
    setNodes((nds) => [...nds, newNode])
    pushToHistory()
    debouncedSave()
  }, [ensureWorkflow, setNodes, pushToHistory, debouncedSave])
  
  // Handle edge creation from agent
  const handleConnectNodes = useCallback(async (detail: ConnectNodesEventDetail) => {
    const canProceed = await ensureWorkflow()
    if (!canProceed) return
    
    // Check for duplicate edges
    const existingEdge = edges.find(
      (e) => e.source === detail.sourceId && e.target === detail.targetId
    )
    if (existingEdge) {
      console.warn("Agent tried to create duplicate edge:", detail)
      toast.error("Connection already exists", {
        description: `These nodes are already connected.`,
      })
      return
    }
    
    // Validate the connection first
    const connection = {
      source: detail.sourceId,
      target: detail.targetId,
      sourceHandle: detail.sourceHandle || null,
      targetHandle: detail.targetHandle || null,
    }
    
    const validation = validateConnection(connection, nodes, edges)
    if (!validation.valid) {
      console.warn("Agent tried to create invalid connection:", validation.error)
      toast.error("Invalid connection", {
        description: validation.errorDetails || validation.error,
      })
      return
    }
    
    const newEdge: Edge = {
      id: detail.edgeId,
      source: detail.sourceId,
      target: detail.targetId,
      sourceHandle: detail.sourceHandle,
      targetHandle: detail.targetHandle,
      type: "curved",
    }
    
    setEdges((eds) => [...eds, newEdge])
    pushToHistory()
    debouncedSave()
  }, [ensureWorkflow, nodes, edges, setEdges, pushToHistory, debouncedSave])
  
  // Handle node deletion from agent
  const handleDeleteNode = useCallback(async (detail: DeleteNodeEventDetail) => {
    const canProceed = await ensureWorkflow()
    if (!canProceed) return
    
    const nodeIdsToDelete = new Set(detail.nodeIds)
    
    // Remove nodes
    setNodes((nds) => nds.filter((n) => !nodeIdsToDelete.has(n.id)))
    
    // Remove connected edges
    setEdges((eds) => eds.filter((e) => 
      !nodeIdsToDelete.has(e.source) && !nodeIdsToDelete.has(e.target)
    ))
    
    pushToHistory()
    debouncedSave()
  }, [ensureWorkflow, setNodes, setEdges, pushToHistory, debouncedSave])
  
  // Handle workflow execution from agent
  const handleExecuteWorkflow = useCallback(async (detail: ExecuteWorkflowEventDetail) => {
    // Only execute if confirmed
    if (!detail.confirmed) return
    
    const canProceed = await ensureWorkflow()
    if (!canProceed) return
    
    // Trigger the workflow execution
    await runWorkflow()
  }, [ensureWorkflow, runWorkflow])
  
  // Get current canvas state for agent context
  const handleGetState = useCallback((): StateResponseEventDetail => {
    return {
      nodes: nodes.map((n) => ({
        id: n.id,
        type: n.type || "unknown",
        position: n.position,
        data: n.data as Record<string, unknown>,
      })),
      edges: edges.map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
      })),
      // Include workflow context
      ...({
        workflowId: workflowIdRef.current,
        isReadOnly: demoMode || !userIdRef.current,
      } as Record<string, unknown>),
    }
  }, [nodes, edges, workflowIdRef, userIdRef, demoMode])
  
  // Set up event listeners
  useEffect(() => {
    const cleanup = setupAgentBridgeListeners({
      onCreateNode: handleCreateNode,
      onConnectNodes: handleConnectNodes,
      onDeleteNode: handleDeleteNode,
      onExecuteWorkflow: handleExecuteWorkflow,
      onGetState: handleGetState,
    })
    
    return cleanup
  }, [handleCreateNode, handleConnectNodes, handleDeleteNode, handleExecuteWorkflow, handleGetState])
}
