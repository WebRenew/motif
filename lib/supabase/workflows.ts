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

  return !error
}

export async function saveEdges(workflowId: string, edges: Edge[]): Promise<boolean> {
  const supabase = createClient()

  await supabase.from("edges").delete().eq("workflow_id", workflowId)

  if (edges.length === 0) return true

  const edgeRecords = edges.map((edge) => ({
    workflow_id: workflowId,
    edge_id: edge.id,
    source_node_id: edge.source,
    target_node_id: edge.target,
  }))

  const { error } = await supabase.from("edges").insert(edgeRecords)

  return !error
}

export async function loadWorkflow(workflowId: string): Promise<WorkflowData | null> {
  const supabase = createClient()

  const { data: workflow, error: workflowError } = await supabase
    .from("workflows")
    .select("*")
    .eq("id", workflowId)
    .single()

  if (workflowError || !workflow) {
    return null
  }

  const { data: nodeRecords, error: nodesError } = await supabase
    .from("nodes")
    .select("*")
    .eq("workflow_id", workflowId)

  if (nodesError) {
    return null
  }

  const { data: edgeRecords, error: edgesError } = await supabase
    .from("edges")
    .select("*")
    .eq("workflow_id", workflowId)

  if (edgesError) {
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
    return []
  }

  return data || []
}

export async function deleteNode(workflowId: string, nodeId: string): Promise<boolean> {
  const supabase = createClient()

  const { error } = await supabase.from("nodes").delete().eq("workflow_id", workflowId).eq("node_id", nodeId)

  return !error
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
    return []
  }

  return data || []
}
