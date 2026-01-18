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

  let sessionId = localStorage.getItem("motif_session_id")
  if (!sessionId) {
    sessionId = crypto.randomUUID()
    localStorage.setItem("motif_session_id", sessionId)
  }
  return sessionId
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

  const { error: deleteError } = await supabase.from("edges").delete().eq("workflow_id", workflowId)

  if (deleteError) {
    console.error("[saveEdges] Failed to delete existing edges:", {
      error: deleteError.message,
      code: deleteError.code,
      workflowId,
      timestamp: new Date().toISOString(),
    })
    return false
  }

  if (edges.length === 0) return true

  const edgeRecords = edges.map((edge) => ({
    workflow_id: workflowId,
    edge_id: edge.id,
    source_node_id: edge.source,
    target_node_id: edge.target,
  }))

  const { error } = await supabase.from("edges").insert(edgeRecords)

  if (error) {
    console.error("[saveEdges] Failed to insert edges:", {
      error: error.message,
      code: error.code,
      workflowId,
      edgeCount: edges.length,
      timestamp: new Date().toISOString(),
    })
    return false
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
