import { createClient } from "./client"
import { getOrCreateAnonymousUser } from "./auth"
import type { Node, Edge } from "@xyflow/react"

export interface WorkflowData {
  id: string
  user_id: string
  name: string
  tool_type: string
  nodes: Node[]
  edges: Edge[]
}

export interface UserTemplate {
  id: string
  name: string
  description?: string
  icon: string
  tags: string[]
  node_count: number
  created_at: string
  updated_at: string
}

const LEGACY_SESSION_KEY = "motif_session_id"

/**
 * Initialize the user and return their ID.
 * Creates an anonymous user if not already authenticated.
 * Also migrates any legacy session-based workflows to the new user.
 */
export async function initializeUser(): Promise<string | null> {
  const user = await getOrCreateAnonymousUser()
  
  if (!user?.id) {
    return null
  }

  // Check for legacy session_id and migrate workflows
  await migrateLegacyWorkflows(user.id)
  
  return user.id
}

/**
 * Migrate workflows from legacy session_id to user_id.
 * This runs once per user to claim any workflows they created before auth was implemented.
 */
async function migrateLegacyWorkflows(userId: string): Promise<void> {
  if (typeof window === "undefined") return

  try {
    const legacySessionId = localStorage.getItem(LEGACY_SESSION_KEY)
    
    if (!legacySessionId) {
      return // No legacy session to migrate
    }

    const supabase = createClient()

    // Find workflows with this session_id that haven't been claimed yet
    const { data: unclaimedWorkflows, error: fetchError } = await supabase
      .from("workflows")
      .select("id")
      .eq("session_id", legacySessionId)
      .is("user_id", null)

    if (fetchError) {
      console.error("[Migration] Failed to fetch legacy workflows:", {
        error: fetchError.message,
        sessionId: legacySessionId,
        timestamp: new Date().toISOString(),
      })
      return
    }

    if (!unclaimedWorkflows || unclaimedWorkflows.length === 0) {
      // No workflows to migrate, clean up the legacy key
      localStorage.removeItem(LEGACY_SESSION_KEY)
      console.log("[Migration] No legacy workflows to migrate, cleaned up session key")
      return
    }

    // Migrate each workflow to the new user
    const workflowIds = unclaimedWorkflows.map((w) => w.id)
    
    const { error: updateError } = await supabase
      .from("workflows")
      .update({ user_id: userId })
      .in("id", workflowIds)

    if (updateError) {
      console.error("[Migration] Failed to migrate workflows:", {
        error: updateError.message,
        workflowCount: workflowIds.length,
        userId,
        timestamp: new Date().toISOString(),
      })
      return
    }

    // Success! Clean up the legacy session key
    localStorage.removeItem(LEGACY_SESSION_KEY)
    
    console.log("[Migration] Successfully migrated legacy workflows:", {
      workflowCount: workflowIds.length,
      userId,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error("[Migration] Unexpected error during migration:", {
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString(),
    })
  }
}

/**
 * Create a new workflow for the current user.
 */
export async function createWorkflow(
  userId: string,
  name = "Untitled Workflow",
  toolType = "style-fusion",
): Promise<string | null> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from("workflows")
    .insert({ user_id: userId, name, tool_type: toolType })
    .select("id")
    .single()

  if (error) {
    console.error("[createWorkflow] Failed to create workflow:", {
      error: error.message,
      code: error.code,
      userId,
      timestamp: new Date().toISOString(),
    })
    return null
  }

  return data.id
}

export async function saveNodes(workflowId: string, nodes: Node[]): Promise<boolean> {
  const supabase = createClient()

  // Get current node IDs to determine which to delete
  const currentNodeIds = new Set(nodes.map((n) => n.id))

  // Upsert all current nodes atomically
  if (nodes.length > 0) {
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

    const { error: upsertError } = await supabase.from("nodes").upsert(nodeRecords, {
      onConflict: "workflow_id,node_id",
      ignoreDuplicates: false,
    })

    if (upsertError) {
      console.error("[saveNodes] Failed to upsert nodes:", {
        error: upsertError.message,
        code: upsertError.code,
        workflowId,
        nodeCount: nodes.length,
        timestamp: new Date().toISOString(),
      })
      return false
    }
  }

  // Delete nodes that no longer exist (orphan cleanup)
  // This is safe because we've already upserted the valid nodes
  const { data: existingNodes, error: fetchError } = await supabase
    .from("nodes")
    .select("node_id")
    .eq("workflow_id", workflowId)

  if (fetchError) {
    console.error("[saveNodes] Failed to fetch existing nodes for cleanup:", {
      error: fetchError.message,
      code: fetchError.code,
      workflowId,
      timestamp: new Date().toISOString(),
    })
    // Non-fatal: nodes are saved, just couldn't clean up orphans
    return true
  }

  const orphanNodeIds = (existingNodes || [])
    .map((n) => n.node_id)
    .filter((id) => !currentNodeIds.has(id))

  if (orphanNodeIds.length > 0) {
    const { error: deleteError } = await supabase
      .from("nodes")
      .delete()
      .eq("workflow_id", workflowId)
      .in("node_id", orphanNodeIds)

    if (deleteError) {
      console.error("[saveNodes] Failed to delete orphan nodes:", {
        error: deleteError.message,
        code: deleteError.code,
        workflowId,
        orphanCount: orphanNodeIds.length,
        orphanIds: orphanNodeIds,
        timestamp: new Date().toISOString(),
      })
      // Non-fatal: main nodes are saved
    } else {
      console.log("[saveNodes] Deleted orphan nodes:", {
        workflowId,
        orphanCount: orphanNodeIds.length,
        orphanIds: orphanNodeIds,
      })
    }
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

  // Parallelize all three queries for faster loading
  const [
    { data: workflow, error: workflowError },
    { data: nodeRecords, error: nodesError },
    { data: edgeRecords, error: edgesError }
  ] = await Promise.all([
    supabase.from("workflows").select("*").eq("id", workflowId).single(),
    supabase.from("nodes").select("*").eq("workflow_id", workflowId),
    supabase.from("edges").select("*").eq("workflow_id", workflowId)
  ])

  if (workflowError || !workflow) {
    console.error("[loadWorkflow] Failed to load workflow:", {
      error: workflowError?.message,
      code: workflowError?.code,
      workflowId,
      timestamp: new Date().toISOString(),
    })
    return null
  }

  if (nodesError) {
    console.error("[loadWorkflow] Failed to load nodes:", {
      error: nodesError.message,
      code: nodesError.code,
      workflowId,
      timestamp: new Date().toISOString(),
    })
    return null
  }

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
    user_id: workflow.user_id,
    name: workflow.name,
    tool_type: workflow.tool_type || "style-fusion",
    nodes,
    edges,
  }
}

/**
 * Get all workflows for a user, ordered by most recently updated.
 */
export async function getUserWorkflows(
  userId: string,
): Promise<{ id: string; name: string; updated_at: string }[]> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from("workflows")
    .select("id, name, updated_at")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })

  if (error) {
    console.error("[getUserWorkflows] Failed to fetch workflows:", {
      error: error.message,
      code: error.code,
      userId,
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

/**
 * Get workflows for a user filtered by tool type.
 */
export async function getUserWorkflowsByTool(
  userId: string,
  toolType: string,
): Promise<{ id: string; name: string; updated_at: string }[]> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from("workflows")
    .select("id, name, updated_at")
    .eq("user_id", userId)
    .eq("tool_type", toolType)
    .order("updated_at", { ascending: false })

  if (error) {
    console.error("[getUserWorkflowsByTool] Failed to fetch workflows:", {
      error: error.message,
      code: error.code,
      userId,
      toolType,
      timestamp: new Date().toISOString(),
    })
    return []
  }

  return data || []
}

/**
 * Save current workflow as a user template.
 */
export async function saveAsTemplate(
  userId: string,
  name: string,
  nodes: Node[],
  edges: Edge[],
  icon = "workflow",
  tags: string[] = [],
  description?: string,
): Promise<string | null> {
  const supabase = createClient()

  // Create a new workflow marked as a template
  const { data: workflow, error: workflowError } = await supabase
    .from("workflows")
    .insert({
      user_id: userId,
      name,
      tool_type: "custom-template",
      is_template: true,
      template_icon: icon,
      template_tags: tags,
      description,
    })
    .select("id")
    .single()

  if (workflowError || !workflow) {
    console.error("[saveAsTemplate] Failed to create template workflow:", {
      error: workflowError?.message,
      code: workflowError?.code,
      userId,
      timestamp: new Date().toISOString(),
    })
    return null
  }

  // Save nodes and edges
  const nodesSaved = await saveNodes(workflow.id, nodes)
  const edgesSaved = await saveEdges(workflow.id, edges)

  if (!nodesSaved || !edgesSaved) {
    // Cleanup the workflow if nodes/edges failed to save
    await supabase.from("workflows").delete().eq("id", workflow.id)
    return null
  }

  return workflow.id
}

/**
 * Get all user templates with metadata.
 */
export async function getUserTemplates(userId: string): Promise<UserTemplate[]> {
  const supabase = createClient()

  const { data: templates, error } = await supabase
    .from("workflows")
    .select("id, name, description, template_icon, template_tags, created_at, updated_at")
    .eq("user_id", userId)
    .eq("is_template", true)
    .order("updated_at", { ascending: false })

  if (error) {
    console.error("[getUserTemplates] Failed to fetch templates:", {
      error: error.message,
      code: error.code,
      userId,
      timestamp: new Date().toISOString(),
    })
    return []
  }

  if (!templates) return []

  // Get node counts for each template
  const templatesWithCounts = await Promise.all(
    templates.map(async (template) => {
      const { count } = await supabase
        .from("nodes")
        .select("*", { count: "exact", head: true })
        .eq("workflow_id", template.id)

      return {
        id: template.id,
        name: template.name,
        description: template.description || undefined,
        icon: template.template_icon || "workflow",
        tags: template.template_tags || [],
        node_count: count || 0,
        created_at: template.created_at,
        updated_at: template.updated_at,
      }
    }),
  )

  return templatesWithCounts
}

/**
 * Delete a user template.
 */
export async function deleteTemplate(templateId: string, userId: string): Promise<boolean> {
  const supabase = createClient()

  const { error } = await supabase
    .from("workflows")
    .delete()
    .eq("id", templateId)
    .eq("user_id", userId)
    .eq("is_template", true)

  if (error) {
    console.error("[deleteTemplate] Failed to delete template:", {
      error: error.message,
      code: error.code,
      templateId,
      userId,
      timestamp: new Date().toISOString(),
    })
    return false
  }

  return true
}
