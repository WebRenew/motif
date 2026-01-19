import { createClient } from "./client"
import type { Node, Edge } from "@xyflow/react"

export interface WorkflowData {
  id: string
  session_id: string
  name: string
  tool_type: string
  nodes: Node[]
  edges: Edge[]
}

export function getSessionId(): string {
  if (typeof window === "undefined") return ""

  try {
    let sessionId = localStorage.getItem("motif_session_id")
    if (!sessionId) {
      sessionId = crypto.randomUUID()
      localStorage.setItem("motif_session_id", sessionId)
    }
    return sessionId
  } catch (error) {
    // localStorage can throw in private browsing mode or when storage is disabled
    console.warn("[getSessionId] localStorage unavailable, using ephemeral session:", {
      error: error instanceof Error ? error.message : String(error),
    })
    // Return a temporary session ID that won't persist across page reloads
    // This allows the app to function without persistent storage
    return `ephemeral-${crypto.randomUUID()}`
  }
}

export async function createWorkflow(
  sessionId: string,
  name = "Untitled Workflow",
  toolType = "style-fusion",
): Promise<string | null> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from("workflows")
    .insert({ session_id: sessionId, name, tool_type: toolType })
    .select("id")
    .single()

  if (error) {
    console.error("[createWorkflow] Failed to create workflow:", {
      error: error.message,
      code: error.code,
      sessionId,
      timestamp: new Date().toISOString(),
    })
    return null
  }

  return data.id
}

export async function saveNodes(workflowId: string, nodes: Node[]): Promise<boolean> {
  const supabase = createClient()

  const nodeRecords = nodes.map((node) => ({
    workflow_id: workflowId,
    node_id: node.id,
    node_type: node.type || "image",
    position_x: node.position.x,
    position_y: node.position.y,
    width: node.width,
    height: node.height,
    data: node.data,
  }))

  const { error } = await supabase.from("nodes").upsert(nodeRecords, {
    onConflict: "workflow_id,node_id",
    ignoreDuplicates: false,
  })

  if (error) {
    console.error("[saveNodes] Failed to save nodes:", {
      error: error.message,
      code: error.code,
      workflowId,
      nodeCount: nodes.length,
      timestamp: new Date().toISOString(),
    })
    return false
  }

  return true
}

export async function saveEdges(workflowId: string, edges: Edge[]): Promise<boolean> {
  const supabase = createClient()

  // Get current edge IDs to determine which to delete
  const currentEdgeIds = new Set(edges.map((e) => e.id))

  // Upsert all current edges atomically
  if (edges.length > 0) {
    const edgeRecords = edges.map((edge) => ({
      workflow_id: workflowId,
      edge_id: edge.id,
      source_node_id: edge.source,
      target_node_id: edge.target,
    }))

    const { error: upsertError } = await supabase.from("edges").upsert(edgeRecords, {
      onConflict: "workflow_id,edge_id",
      ignoreDuplicates: false,
    })

    if (upsertError) {
      console.error("[saveEdges] Failed to upsert edges:", {
        error: upsertError.message,
        code: upsertError.code,
        workflowId,
        edgeCount: edges.length,
        timestamp: new Date().toISOString(),
      })
      return false
    }
  }

  // Delete edges that no longer exist (orphan cleanup)
  // This is safe because we've already upserted the valid edges
  const { data: existingEdges, error: fetchError } = await supabase
    .from("edges")
    .select("edge_id")
    .eq("workflow_id", workflowId)

  if (fetchError) {
    console.error("[saveEdges] Failed to fetch existing edges for cleanup:", {
      error: fetchError.message,
      code: fetchError.code,
      workflowId,
      timestamp: new Date().toISOString(),
    })
    // Non-fatal: edges are saved, just couldn't clean up orphans
    return true
  }

  const orphanEdgeIds = (existingEdges || [])
    .map((e) => e.edge_id)
    .filter((id) => !currentEdgeIds.has(id))

  if (orphanEdgeIds.length > 0) {
    const { error: deleteError } = await supabase
      .from("edges")
      .delete()
      .eq("workflow_id", workflowId)
      .in("edge_id", orphanEdgeIds)

    if (deleteError) {
      console.error("[saveEdges] Failed to delete orphan edges:", {
        error: deleteError.message,
        code: deleteError.code,
        workflowId,
        orphanCount: orphanEdgeIds.length,
        timestamp: new Date().toISOString(),
      })
      // Non-fatal: main edges are saved
    }
  }

  return true
}

export async function loadWorkflow(workflowId: string): Promise<WorkflowData | null> {
  const supabase = createClient()

  const { data: workflow, error: workflowError } = await supabase
    .from("workflows")
    .select("*")
    .eq("id", workflowId)
    .single()

  if (workflowError || !workflow) {
    console.error("[loadWorkflow] Failed to load workflow:", {
      error: workflowError?.message,
      code: workflowError?.code,
      workflowId,
      timestamp: new Date().toISOString(),
    })
    return null
  }

  const { data: nodeRecords, error: nodesError } = await supabase
    .from("nodes")
    .select("*")
    .eq("workflow_id", workflowId)

  if (nodesError) {
    console.error("[loadWorkflow] Failed to load nodes:", {
      error: nodesError.message,
      code: nodesError.code,
      workflowId,
      timestamp: new Date().toISOString(),
    })
    return null
  }

  const { data: edgeRecords, error: edgesError } = await supabase
    .from("edges")
    .select("*")
    .eq("workflow_id", workflowId)

  if (edgesError) {
    console.error("[loadWorkflow] Failed to load edges:", {
      error: edgesError.message,
      code: edgesError.code,
      workflowId,
      timestamp: new Date().toISOString(),
    })
    return null
  }

  const nodes: Node[] = (nodeRecords || []).map((record) => ({
    id: record.node_id,
    type: record.node_type,
    position: { x: record.position_x, y: record.position_y },
    width: record.width,
    height: record.height,
    data: record.data,
  }))

  const edges: Edge[] = (edgeRecords || []).map((record) => ({
    id: record.edge_id,
    source: record.source_node_id,
    target: record.target_node_id,
    type: "curved",
  }))

  return {
    id: workflow.id,
    session_id: workflow.session_id,
    name: workflow.name,
    tool_type: workflow.tool_type || "style-fusion",
    nodes,
    edges,
  }
}

export async function getSessionWorkflows(
  sessionId: string,
): Promise<{ id: string; name: string; updated_at: string }[]> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from("workflows")
    .select("id, name, updated_at")
    .eq("session_id", sessionId)
    .order("updated_at", { ascending: false })

  if (error) {
    console.error("[getSessionWorkflows] Failed to fetch workflows:", {
      error: error.message,
      code: error.code,
      sessionId,
      timestamp: new Date().toISOString(),
    })
    return []
  }

  return data || []
}

export async function deleteNode(workflowId: string, nodeId: string): Promise<boolean> {
  const supabase = createClient()

  const { error } = await supabase.from("nodes").delete().eq("workflow_id", workflowId).eq("node_id", nodeId)

  if (error) {
    console.error("[deleteNode] Failed to delete node:", {
      error: error.message,
      code: error.code,
      workflowId,
      nodeId,
      timestamp: new Date().toISOString(),
    })
    return false
  }

  return true
}

export async function getSessionWorkflowsByTool(
  sessionId: string,
  toolType: string,
): Promise<{ id: string; name: string; updated_at: string }[]> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from("workflows")
    .select("id, name, updated_at")
    .eq("session_id", sessionId)
    .eq("tool_type", toolType)
    .order("updated_at", { ascending: false })

  if (error) {
    console.error("[getSessionWorkflowsByTool] Failed to fetch workflows:", {
      error: error.message,
      code: error.code,
      sessionId,
      toolType,
      timestamp: new Date().toISOString(),
    })
    return []
  }

  return data || []
}
