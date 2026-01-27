import { createClient } from "./client"
import { getCurrentUser } from "./auth"
import type { Node, Edge } from "@xyflow/react"
import { createLogger } from "@/lib/logger"
import type { AnimationCapture } from "./animation-captures"
import { isValidUUID } from "@/lib/utils"
import {
  MAX_PROMPT_LENGTH,
  MAX_LABEL_LENGTH,
  MAX_CODE_LENGTH,
  MAX_IMAGE_URL_LENGTH,
  MAX_MODEL_ID_LENGTH,
  MAX_LANGUAGE_ID_LENGTH,
  DEFAULT_EDGE_TYPE,
} from "@/lib/constants"

const logger = createLogger('workflows')

// Note: UUID validation is imported from lib/utils.ts - single source of truth
// Note: Length limits are imported from lib/constants.ts - single source of truth

/**
 * Sanitize node data retrieved from the database.
 * Validates types and enforces length limits on user-provided content
 * to prevent trust boundary violations.
 * 
 * Note: Truncation is logged for debugging but intentionally not surfaced
 * to users as it indicates malformed data (likely from manual DB edits or bugs).
 */
function sanitizeNodeData(data: unknown): Record<string, unknown> {
  if (!data || typeof data !== "object") {
    return {}
  }

  const rawData = data as Record<string, unknown>
  const sanitized: Record<string, unknown> = { ...rawData }

  // Sanitize prompt field (user-provided text)
  if ("prompt" in rawData) {
    const prompt = rawData.prompt
    if (typeof prompt === "string") {
      if (prompt.length > MAX_PROMPT_LENGTH) {
        logger.warn('Prompt truncated during sanitization', {
          originalLength: prompt.length,
          maxLength: MAX_PROMPT_LENGTH,
        })
      }
      sanitized.prompt = prompt.slice(0, MAX_PROMPT_LENGTH)
    } else {
      sanitized.prompt = ""
    }
  }

  // Sanitize label field (user-provided text)
  if ("label" in rawData) {
    const label = rawData.label
    if (typeof label === "string" && label.length > MAX_LABEL_LENGTH) {
      logger.warn('Label truncated during sanitization', {
        originalLength: label.length,
        maxLength: MAX_LABEL_LENGTH,
      })
      sanitized.label = label.slice(0, MAX_LABEL_LENGTH)
    } else {
      sanitized.label = typeof label === "string" ? label.slice(0, MAX_LABEL_LENGTH) : label
    }
  }

  // Sanitize code field (generated or user-provided code)
  if ("code" in rawData) {
    const code = rawData.code
    if (typeof code === "string") {
      if (code.length > MAX_CODE_LENGTH) {
        logger.warn('Code truncated during sanitization', {
          originalLength: code.length,
          maxLength: MAX_CODE_LENGTH,
        })
      }
      sanitized.code = code.slice(0, MAX_CODE_LENGTH)
    } else {
      sanitized.code = ""
    }
  }

  // Sanitize image URL field
  if ("image" in rawData) {
    const image = rawData.image
    if (typeof image === "string" && image.length > MAX_IMAGE_URL_LENGTH) {
      logger.warn('Image URL truncated during sanitization', {
        originalLength: image.length,
        maxLength: MAX_IMAGE_URL_LENGTH,
      })
      sanitized.image = image.slice(0, MAX_IMAGE_URL_LENGTH)
    } else {
      sanitized.image = typeof image === "string" ? image.slice(0, MAX_IMAGE_URL_LENGTH) : image
    }
  }

  // Sanitize model field (should be a valid model identifier)
  if ("model" in rawData) {
    sanitized.model = typeof rawData.model === "string"
      ? rawData.model.slice(0, MAX_MODEL_ID_LENGTH)
      : rawData.model
  }

  // Sanitize language field
  if ("language" in rawData) {
    sanitized.language = typeof rawData.language === "string"
      ? rawData.language.slice(0, MAX_LANGUAGE_ID_LENGTH)
      : rawData.language
  }

  // Ensure boolean fields are actually booleans
  if ("isRunning" in rawData) {
    sanitized.isRunning = typeof rawData.isRunning === "boolean"
      ? rawData.isRunning
      : false
  }

  if ("hasRun" in rawData) {
    sanitized.hasRun = typeof rawData.hasRun === "boolean"
      ? rawData.hasRun
      : false
  }

  // Sanitize capture node fields
  if ("excludedFrames" in rawData) {
    // Ensure it's an array of numbers
    const frames = rawData.excludedFrames
    sanitized.excludedFrames = Array.isArray(frames)
      ? frames.filter((f): f is number => typeof f === "number" && Number.isFinite(f))
      : []
  }

  if ("includeHtml" in rawData) {
    sanitized.includeHtml = typeof rawData.includeHtml === "boolean"
      ? rawData.includeHtml
      : true // Default to true
  }

  if ("totalFrames" in rawData) {
    sanitized.totalFrames = typeof rawData.totalFrames === "number" && Number.isFinite(rawData.totalFrames)
      ? rawData.totalFrames
      : undefined
  }

  if ("videoUrl" in rawData) {
    sanitized.videoUrl = typeof rawData.videoUrl === "string"
      ? rawData.videoUrl.slice(0, MAX_IMAGE_URL_LENGTH)
      : undefined
  }

  return sanitized
}

interface WorkflowData {
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
 * Legacy migration runs in background (non-blocking).
 */
export async function initializeUser(): Promise<string | null> {
  const user = await getCurrentUser()

  if (!user?.id) {
    return null
  }

  // Fire-and-forget: migrate legacy workflows in background
  // Don't block the critical path - this is a one-time migration
  migrateLegacyWorkflows(user.id).catch((error) => {
    logger.debug('Legacy migration failed (non-critical)', {
      error: error instanceof Error ? error.message : String(error),
    })
  })

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
      logger.error('Failed to fetch legacy workflows', {
        error: fetchError.message,
        sessionId: legacySessionId,
      })
      return
    }

    if (!unclaimedWorkflows || unclaimedWorkflows.length === 0) {
      // No workflows to migrate, clean up the legacy key
      localStorage.removeItem(LEGACY_SESSION_KEY)
      logger.info('No legacy workflows to migrate, cleaned up session key')
      return
    }

    // Migrate each workflow to the new user
    const workflowIds = unclaimedWorkflows.map((w) => w.id)
    
    const { error: updateError } = await supabase
      .from("workflows")
      .update({ user_id: userId })
      .in("id", workflowIds)

    if (updateError) {
      logger.error('Failed to migrate workflows', {
        error: updateError.message,
        workflowCount: workflowIds.length,
        userId: userId.slice(0, 8) + '...',
      })
      return
    }

    // Success! Clean up the legacy session key
    localStorage.removeItem(LEGACY_SESSION_KEY)
    
    logger.info('Successfully migrated legacy workflows', {
      workflowCount: workflowIds.length,
      userId: userId.slice(0, 8) + '...',
    })
  } catch (error) {
    logger.error('Unexpected error during migration', {
      error: error instanceof Error ? error.message : String(error),
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
    logger.error('Failed to create workflow', {
      error: error.message,
      code: error.code,
      userId: userId.slice(0, 8) + '...',
    })
    return null
  }

  return data.id
}

/**
 * Create a new workflow with pre-populated nodes and edges (for tool templates).
 * Generates new UUIDs for all nodes/edges to ensure they can be saved later.
 */
export async function createWorkflowWithTemplate(
  userId: string,
  name: string,
  nodes: Node[],
  edges: Edge[],
  toolType = "style-fusion",
): Promise<string | null> {
  // Validate userId format
  if (!isValidUUID(userId)) {
    logger.warn('Invalid userId format in createWorkflowWithTemplate', { userId })
    return null
  }

  // Sanitize name length
  const sanitizedName = name.slice(0, MAX_LABEL_LENGTH)

  const supabase = createClient()

  // Create the workflow first
  const { data: workflowData, error: workflowError } = await supabase
    .from("workflows")
    .insert({ user_id: userId, name: sanitizedName, tool_type: toolType })
    .select("id")
    .single()

  if (workflowError || !workflowData) {
    logger.error('Failed to create workflow with template', {
      error: workflowError?.message,
      code: workflowError?.code,
      userId: userId.slice(0, 8) + '...',
    })
    return null
  }

  const workflowId = workflowData.id

  // Generate new UUIDs for nodes (template IDs like "input-design" won't pass validation later)
  // Build a mapping from old ID to new UUID for edge source/target updates
  const nodeIdMap = new Map<string, string>()
  const nodesWithUUIDs = nodes.map((node) => {
    const newId = crypto.randomUUID()
    nodeIdMap.set(node.id, newId)
    return { ...node, id: newId }
  })

  // Insert nodes if there are any
  if (nodesWithUUIDs.length > 0) {
    const nodeRecords = nodesWithUUIDs.map((node) => ({
      workflow_id: workflowId,
      node_id: node.id,
      node_type: node.type || "imageNode",
      position_x: node.position.x,
      position_y: node.position.y,
      width: node.width,
      height: node.height,
      data: node.data,
    }))

    const { error: nodesError } = await supabase.from("nodes").insert(nodeRecords)

    if (nodesError) {
      logger.error('Failed to insert template nodes', {
        error: nodesError.message,
        code: nodesError.code,
        workflowId,
        nodeCount: nodesWithUUIDs.length,
      })
      // Clean up workflow on failure
      const { error: cleanupError } = await supabase.from("workflows").delete().eq("id", workflowId)
      if (cleanupError) {
        logger.error('Failed to cleanup workflow after node insert failure', {
          workflowId,
          originalError: nodesError.message,
          cleanupError: cleanupError.message,
        })
      }
      return null
    }
  }

  // Insert edges if there are any, mapping source/target to new UUIDs
  if (edges.length > 0) {
    const edgeRecords = edges.map((edge) => ({
      workflow_id: workflowId,
      edge_id: crypto.randomUUID(),
      source_node_id: nodeIdMap.get(edge.source) || edge.source,
      target_node_id: nodeIdMap.get(edge.target) || edge.target,
      source_handle: edge.sourceHandle,
      target_handle: edge.targetHandle,
      edge_type: edge.type || DEFAULT_EDGE_TYPE,
    }))

    const { error: edgesError } = await supabase.from("edges").insert(edgeRecords)

    if (edgesError) {
      logger.error('Failed to insert template edges', {
        error: edgesError.message,
        code: edgesError.code,
        workflowId,
        edgeCount: edges.length,
      })
      // Clean up workflow and nodes on failure (order matters for FK constraints)
      const { error: nodesCleanupError } = await supabase.from("nodes").delete().eq("workflow_id", workflowId)
      const { error: workflowCleanupError } = await supabase.from("workflows").delete().eq("id", workflowId)
      if (nodesCleanupError || workflowCleanupError) {
        logger.error('Failed to cleanup after edge insert failure', {
          workflowId,
          originalError: edgesError.message,
          nodesCleanupError: nodesCleanupError?.message,
          workflowCleanupError: workflowCleanupError?.message,
        })
      }
      return null
    }
  }

  return workflowId
}

export async function saveNodes(workflowId: string, nodes: Node[]): Promise<boolean> {
  // Validate workflow_id format to prevent injection
  if (!isValidUUID(workflowId)) {
    logger.warn('Invalid workflow_id format, rejecting operation', { workflowId })
    return false
  }

  // Validate all node IDs and filter out invalid ones
  const validNodes: Node[] = []
  for (const node of nodes) {
    if (!isValidUUID(node.id)) {
      logger.warn('Skipping node with invalid ID format', {
        nodeId: node.id,
        workflowId,
      })
      continue
    }
    validNodes.push(node)
  }

  const supabase = createClient()

  // Get current node IDs to determine which to delete
  const currentNodeIds = new Set(validNodes.map((n) => n.id))

  // Upsert all current nodes atomically
  if (validNodes.length > 0) {
    const nodeRecords = validNodes.map((node) => ({
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
      logger.error('Failed to upsert nodes', {
        error: upsertError.message,
        code: upsertError.code,
        workflowId,
        nodeCount: validNodes.length,
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
    logger.error('Failed to fetch existing nodes for cleanup', {
      error: fetchError.message,
      code: fetchError.code,
      workflowId,
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
      logger.error('Failed to delete orphan nodes', {
        error: deleteError.message,
        code: deleteError.code,
        workflowId,
        orphanCount: orphanNodeIds.length,
        orphanIds: orphanNodeIds,
      })
      // Non-fatal: main nodes are saved
    } else {
      logger.info('Deleted orphan nodes', {
        workflowId,
        orphanCount: orphanNodeIds.length,
        orphanIds: orphanNodeIds,
      })
    }
  }

  return true
}

export async function saveEdges(workflowId: string, edges: Edge[]): Promise<boolean> {
  // Validate workflow_id format to prevent injection
  if (!isValidUUID(workflowId)) {
    logger.warn('Invalid workflow_id format, rejecting operation', { workflowId })
    return false
  }

  // Validate all edge IDs and filter out invalid ones
  const validEdges: Edge[] = []
  for (const edge of edges) {
    if (!isValidUUID(edge.id)) {
      logger.warn('Skipping edge with invalid ID format', {
        edgeId: edge.id,
        workflowId,
      })
      continue
    }
    validEdges.push(edge)
  }

  const supabase = createClient()

  // Get current edge IDs to determine which to delete
  const currentEdgeIds = new Set(validEdges.map((e) => e.id))

  // Upsert all current edges atomically
  if (validEdges.length > 0) {
    const edgeRecords = validEdges.map((edge) => ({
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
      logger.error('Failed to upsert edges', {
        error: upsertError.message,
        code: upsertError.code,
        workflowId,
        edgeCount: validEdges.length,
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
    logger.error('Failed to fetch existing edges for cleanup', {
      error: fetchError.message,
      code: fetchError.code,
      workflowId,
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
      logger.error('Failed to delete orphan edges', {
        error: deleteError.message,
        code: deleteError.code,
        workflowId,
        orphanCount: orphanEdgeIds.length,
      })
      // Non-fatal: main edges are saved
    }
  }

  return true
}

export async function loadWorkflow(workflowId: string): Promise<WorkflowData | null> {
  // Validate workflow_id format to prevent injection
  if (!isValidUUID(workflowId)) {
    logger.warn('Invalid workflow_id format, rejecting operation', { workflowId })
    return null
  }

  const supabase = createClient()

  // Get the current authenticated user for authorization check
  const { data: { user } } = await supabase.auth.getUser()

  // Parallelize all queries for faster loading
  const [
    { data: workflow, error: workflowError },
    { data: nodeRecords, error: nodesError },
    { data: edgeRecords, error: edgesError },
    { data: captureRecords, error: capturesError }
  ] = await Promise.all([
    supabase.from("workflows").select("*").eq("id", workflowId).single(),
    supabase.from("nodes").select("*").eq("workflow_id", workflowId),
    supabase.from("edges").select("*").eq("workflow_id", workflowId),
    // Fetch animation captures for this workflow to hydrate capture nodes
    supabase.from("animation_captures").select("*").eq("workflow_id", workflowId)
  ])

  if (workflowError || !workflow) {
    logger.error('Failed to load workflow', {
      error: workflowError?.message,
      code: workflowError?.code,
      workflowId,
    })
    return null
  }

  // Authorization check: verify the current user owns this workflow
  // This prevents unauthorized access via ID enumeration
  if (workflow.user_id) {
    // Workflow has an owner - must match current user
    if (!user || workflow.user_id !== user.id) {
      logger.error('Unauthorized access attempt', {
        workflowId,
        workflowOwnerId: workflow.user_id,
        requestingUserId: user?.id || "unauthenticated",
      })
      return null
    }
  } else {
    // Workflow has no owner (legacy/orphan) - deny access
    // These should be claimed via migration, not accessed directly
    logger.error('Access denied to orphan workflow', {
      workflowId,
      requestingUserId: user?.id || "unauthenticated",
    })
    return null
  }

  if (nodesError) {
    logger.error('Failed to load nodes', {
      error: nodesError.message,
      code: nodesError.code,
      workflowId,
    })
    return null
  }

  if (edgesError) {
    logger.error('Failed to load edges', {
      error: edgesError.message,
      code: edgesError.code,
      workflowId,
    })
    return null
  }

  // Log but don't fail if captures couldn't be loaded (non-critical)
  if (capturesError) {
    logger.warn('Failed to load animation captures', {
      error: capturesError.message,
      code: capturesError.code,
      workflowId,
    })
  }

  // Build a map of node_id -> capture data for quick lookup
  const capturesByNodeId = new Map<string, AnimationCapture>()
  if (captureRecords) {
    for (const capture of captureRecords) {
      if (capture.node_id && capture.status === 'completed') {
        capturesByNodeId.set(capture.node_id, capture as AnimationCapture)
      }
    }
  }

  const nodes: Node[] = (nodeRecords || []).map((record) => {
    const baseData = sanitizeNodeData(record.data)

    // Hydrate capture nodes with their saved capture results
    if (record.node_type === 'captureNode') {
      const capture = capturesByNodeId.get(record.node_id)
      if (capture) {
        return {
          id: record.node_id,
          type: record.node_type,
          position: { x: record.position_x, y: record.position_y },
          width: record.width,
          height: record.height,
          data: {
            ...baseData,
            status: 'complete',
            videoUrl: capture.video_url,
            captureId: capture.id,
            animationContext: capture.animation_context,
            // Calculate totalFrames from screenshot strip width if available
            totalFrames: baseData.totalFrames || 8, // Default to 8 frames
          },
        }
      }
    }

    return {
      id: record.node_id,
      type: record.node_type,
      position: { x: record.position_x, y: record.position_y },
      width: record.width,
      height: record.height,
      data: baseData,
    }
  })

  const edges: Edge[] = (edgeRecords || []).map((record) => ({
    id: record.edge_id,
    source: record.source_node_id,
    target: record.target_node_id,
    type: DEFAULT_EDGE_TYPE,
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

// Default pagination limit to prevent unbounded queries
const DEFAULT_WORKFLOW_LIMIT = 100
const MAX_WORKFLOW_LIMIT = 500

/**
 * Get workflows for a user, ordered by most recently updated.
 * Paginated to prevent performance issues with power users.
 */
export async function getUserWorkflows(
  userId: string,
  options: { limit?: number; offset?: number } = {},
): Promise<{ id: string; name: string; updated_at: string }[]> {
  const supabase = createClient()

  // Enforce pagination limits to prevent memory exhaustion
  const limit = Math.min(options.limit || DEFAULT_WORKFLOW_LIMIT, MAX_WORKFLOW_LIMIT)
  const offset = options.offset || 0

  const { data, error } = await supabase
    .from("workflows")
    .select("id, name, updated_at")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .range(offset, offset + limit - 1)

  if (error) {
    logger.error('Failed to fetch workflows', {
      error: error.message,
      code: error.code,
      userId: userId.slice(0, 8) + '...',
      limit,
      offset,
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
    logger.error('Failed to create template workflow', {
      error: workflowError?.message,
      code: workflowError?.code,
      userId: userId.slice(0, 8) + '...',
    })
    return null
  }

  // Save nodes and edges in parallel for faster save
  const [nodesSaved, edgesSaved] = await Promise.all([
    saveNodes(workflow.id, nodes),
    saveEdges(workflow.id, edges),
  ])

  if (!nodesSaved || !edgesSaved) {
    // Cleanup the workflow if nodes/edges failed to save
    await supabase.from("workflows").delete().eq("id", workflow.id)
    return null
  }

  return workflow.id
}

// Default pagination limit for templates
const DEFAULT_TEMPLATE_LIMIT = 50
const MAX_TEMPLATE_LIMIT = 200

/**
 * Get user templates with metadata.
 * Fetches templates first, then gets all node counts in a single batch query
 * to avoid N+1 queries (1 query for templates + 1 query for all node counts).
 * Paginated to prevent performance issues.
 */
export async function getUserTemplates(
  userId: string,
  options: { limit?: number; offset?: number } = {},
): Promise<UserTemplate[]> {
  const supabase = createClient()

  // Enforce pagination limits
  const limit = Math.min(options.limit || DEFAULT_TEMPLATE_LIMIT, MAX_TEMPLATE_LIMIT)
  const offset = options.offset || 0

  // First, fetch templates with pagination
  const { data: templates, error } = await supabase
    .from("workflows")
    .select("id, name, description, template_icon, template_tags, created_at, updated_at")
    .eq("user_id", userId)
    .eq("is_template", true)
    .order("updated_at", { ascending: false })
    .range(offset, offset + limit - 1)

  if (error) {
    logger.error('Failed to fetch templates', {
      error: error.message,
      code: error.code,
      userId: userId.slice(0, 8) + '...',
    })
    return []
  }

  if (!templates || templates.length === 0) return []

  // Get all node counts in a single batch query instead of N separate queries
  const templateIds = templates.map(t => t.id)
  const { data: nodes } = await supabase
    .from("nodes")
    .select("workflow_id")
    .in("workflow_id", templateIds)

  // Build a map of workflow_id -> node count
  const nodeCountMap = new Map<string, number>()
  if (nodes) {
    for (const node of nodes) {
      const count = nodeCountMap.get(node.workflow_id) || 0
      nodeCountMap.set(node.workflow_id, count + 1)
    }
  }

  // Map templates with their node counts
  return templates.map((template) => ({
    id: template.id,
    name: template.name,
    description: template.description || undefined,
    icon: template.template_icon || "workflow",
    tags: template.template_tags || [],
    node_count: nodeCountMap.get(template.id) || 0,
    created_at: template.created_at,
    updated_at: template.updated_at,
  }))
}

/**
 * Get workflows for a user filtered by tool type, ordered by most recently updated.
 * Used for the session history sidebar in tool pages.
 */
export async function getToolWorkflows(
  userId: string,
  toolType: string,
  options: { limit?: number } = {},
): Promise<{ id: string; name: string; updated_at: string }[]> {
  if (!isValidUUID(userId)) {
    logger.warn('Invalid userId format in getToolWorkflows', { userId })
    return []
  }

  const supabase = createClient()

  const limit = Math.min(options.limit || 50, MAX_WORKFLOW_LIMIT)

  const { data, error } = await supabase
    .from("workflows")
    .select("id, name, updated_at")
    .eq("user_id", userId)
    .eq("tool_type", toolType)
    .eq("is_template", false)
    .order("updated_at", { ascending: false })
    .limit(limit)

  if (error) {
    logger.error('Failed to fetch tool workflows', {
      error: error.message,
      code: error.code,
      userId: userId.slice(0, 8) + '...',
      toolType,
    })
    return []
  }

  return data || []
}

/**
 * Get favorite workflows for a user, ordered by most recently updated.
 */
export async function getFavoriteWorkflows(
  userId: string,
  options: { limit?: number } = {},
): Promise<{ id: string; name: string; tool_type: string; updated_at: string }[]> {
  if (!isValidUUID(userId)) {
    logger.warn('Invalid userId format in getFavoriteWorkflows', { userId })
    return []
  }

  const supabase = createClient()

  const limit = Math.min(options.limit || 50, MAX_WORKFLOW_LIMIT)

  const { data, error } = await supabase
    .from("workflows")
    .select("id, name, tool_type, updated_at")
    .eq("user_id", userId)
    .eq("is_favorite", true)
    .order("updated_at", { ascending: false })
    .limit(limit)

  if (error) {
    logger.error('Failed to fetch favorite workflows', {
      error: error.message,
      code: error.code,
      userId: userId.slice(0, 8) + '...',
    })
    return []
  }

  return data || []
}

/**
 * Toggle the favorite status of a workflow.
 * Requires authenticated user - only updates workflows owned by the current user.
 */
export async function toggleWorkflowFavorite(
  workflowId: string,
  isFavorite: boolean,
): Promise<boolean> {
  if (!isValidUUID(workflowId)) {
    logger.warn('Invalid workflow_id format in toggleWorkflowFavorite', { workflowId })
    return false
  }

  const supabase = createClient()

  // Get the current authenticated user for explicit ownership check
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    logger.warn('toggleWorkflowFavorite called without authenticated user', { workflowId })
    return false
  }

  // Explicitly filter by user_id for clear authorization
  const { data, error } = await supabase
    .from("workflows")
    .update({ is_favorite: isFavorite })
    .eq("id", workflowId)
    .eq("user_id", user.id)
    .select("id")

  if (error) {
    logger.error('Failed to toggle workflow favorite', {
      error: error.message,
      code: error.code,
      workflowId,
      isFavorite,
    })
    return false
  }

  // Check if the update actually affected a row (workflow exists and user owns it)
  if (!data || data.length === 0) {
    logger.warn('toggleWorkflowFavorite: workflow not found or not owned by user', {
      workflowId: workflowId.slice(0, 8) + '...',
      userId: user.id.slice(0, 8) + '...',
    })
    return false
  }

  return true
}

/**
 * Get recent workflows for a user (for general history panel).
 * Returns workflows ordered by most recently updated.
 */
export async function getRecentWorkflows(
  userId: string,
  options: { limit?: number } = {},
): Promise<{ id: string; name: string; tool_type: string; updated_at: string; is_favorite: boolean }[]> {
  if (!isValidUUID(userId)) {
    logger.warn('Invalid userId format in getRecentWorkflows', { userId })
    return []
  }

  const supabase = createClient()

  const limit = Math.min(options.limit || 20, MAX_WORKFLOW_LIMIT)

  const { data, error } = await supabase
    .from("workflows")
    .select("id, name, tool_type, updated_at, is_favorite")
    .eq("user_id", userId)
    .eq("is_template", false)
    .order("updated_at", { ascending: false })
    .limit(limit)

  if (error) {
    logger.error('Failed to fetch recent workflows', {
      error: error.message,
      code: error.code,
      userId: userId.slice(0, 8) + '...',
    })
    return []
  }

  return data || []
}

/**
 * Rename a workflow.
 * Requires authenticated user - only updates workflows owned by the current user.
 */
export async function renameWorkflow(
  workflowId: string,
  newName: string,
): Promise<boolean> {
  if (!isValidUUID(workflowId)) {
    logger.warn('Invalid workflow_id format in renameWorkflow', { workflowId })
    return false
  }

  // Sanitize and validate name
  const sanitizedName = newName.trim().slice(0, MAX_LABEL_LENGTH)
  if (!sanitizedName) {
    logger.warn('Empty name provided to renameWorkflow', { workflowId })
    return false
  }

  const supabase = createClient()

  // Get the current authenticated user for explicit ownership check
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    logger.warn('renameWorkflow called without authenticated user', { workflowId })
    return false
  }

  // Explicitly filter by user_id for clear authorization
  const { data, error } = await supabase
    .from("workflows")
    .update({ name: sanitizedName })
    .eq("id", workflowId)
    .eq("user_id", user.id)
    .select("id")

  if (error) {
    logger.error('Failed to rename workflow', {
      error: error.message,
      code: error.code,
      workflowId,
    })
    return false
  }

  // Check if the update actually affected a row
  if (!data || data.length === 0) {
    logger.warn('renameWorkflow: workflow not found or not owned by user', {
      workflowId: workflowId.slice(0, 8) + '...',
      userId: user.id.slice(0, 8) + '...',
    })
    return false
  }

  return true
}

/**
 * Delete a workflow.
 * Requires authenticated user - only deletes workflows owned by the current user.
 */
export async function deleteWorkflow(
  workflowId: string,
): Promise<boolean> {
  if (!isValidUUID(workflowId)) {
    logger.warn('Invalid workflow_id format in deleteWorkflow', { workflowId })
    return false
  }

  const supabase = createClient()

  // Get the current authenticated user for explicit ownership check
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    logger.warn('deleteWorkflow called without authenticated user', { workflowId })
    return false
  }

  // Explicitly filter by user_id for clear authorization
  const { error } = await supabase
    .from("workflows")
    .delete()
    .eq("id", workflowId)
    .eq("user_id", user.id)

  if (error) {
    logger.error('Failed to delete workflow', {
      error: error.message,
      code: error.code,
      workflowId,
    })
    return false
  }

  return true
}

/**
 * Generate an auto-name for a workflow based on its nodes using AI.
 * Falls back to "Untitled Workflow" on any error.
 */
export async function generateWorkflowName(nodes: Node[]): Promise<string> {
  try {
    const response = await fetch("/api/workflow/autoname", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nodes }),
    })

    if (!response.ok) {
      logger.warn("Auto-name API returned non-OK status", { status: response.status })
      return "Untitled Workflow"
    }

    const data = await response.json()
    return data.name || "Untitled Workflow"
  } catch (error) {
    logger.error("Failed to generate workflow name", {
      error: error instanceof Error ? error.message : String(error),
    })
    return "Untitled Workflow"
  }
}
