import type { WorkflowImage, WorkflowTextInput } from "@/lib/types/workflow"

/**
 * Detects media type from URL or returns default PNG
 */
function detectMediaType(url: string): string {
  if (url.includes("data:")) {
    const match = url.match(/data:([^;]+);/)
    if (match) return match[1]
  } else if (url.endsWith(".jpg") || url.endsWith(".jpeg")) {
    return "image/jpeg"
  } else if (url.endsWith(".webp")) {
    return "image/webp"
  }
  return "image/png"
}

/**
 * Sanitizes base64 data URLs by removing whitespace and newlines
 */
function sanitizeDataUrl(url: string): string {
  // Only process data URLs
  if (!url.startsWith("data:")) {
    return url
  }

  // Extract parts: data:image/png;base64,<base64data>
  const match = url.match(/^(data:[^;]+;base64,)(.+)$/)
  if (!match) {
    return url // Return as-is if format doesn't match
  }

  const [, prefix, base64Data] = match
  // Remove all whitespace characters (spaces, newlines, tabs, etc.)
  const cleanedBase64 = base64Data.replace(/\s+/g, "")

  return `${prefix}${cleanedBase64}`
}

/**
 * Gathers input images from connected nodes for a given node
 * Images are sorted by Y position (top to bottom) and assigned sequence numbers
 */
export function getInputImagesFromNodes(
  nodeId: string,
  nodes: { id: string; type?: string; data: Record<string, unknown>; position?: { x: number; y: number } }[],
  edges: { source: string; target: string }[],
): WorkflowImage[] {
  try {
    const incomingEdges = edges.filter((e) => e.target === nodeId)
    const inputNodeIds = incomingEdges.map((e) => e.source)

    // Collect image nodes with their Y positions
    const imageNodesWithPosition: Array<{
      node: { id: string; type?: string; data: Record<string, unknown>; position?: { x: number; y: number } }
      url: string
      mediaType: string
    }> = []

    for (const inputId of inputNodeIds) {
      const inputNode = nodes.find((n) => n.id === inputId)

      if (!inputNode) continue

      if (inputNode.type === "imageNode" && inputNode.data.imageUrl) {
        const url = inputNode.data.imageUrl as string
        const mediaType = detectMediaType(url)
        // Sanitize data URLs to remove any whitespace that might cause base64 decode errors
        const sanitizedUrl = sanitizeDataUrl(url)
        imageNodesWithPosition.push({ node: inputNode, url: sanitizedUrl, mediaType })
      }
    }

    // Filter out nodes without valid positions before sorting
    const nodesWithValidPosition = imageNodesWithPosition.filter(
      item => item.node.position && typeof item.node.position.y === "number" && Number.isFinite(item.node.position.y)
    )

    // Nodes without positions (shouldn't happen in practice, but defensive)
    const nodesWithoutPosition = imageNodesWithPosition.filter(
      item => !item.node.position || typeof item.node.position.y !== "number" || !Number.isFinite(item.node.position.y)
    )

    // Sort valid nodes by Y position (top to bottom)
    nodesWithValidPosition.sort((a, b) => {
      return a.node.position!.y - b.node.position!.y  // Safe to use ! after filter
    })

    // Combine: positioned nodes first (sorted), then unpositioned nodes (shouldn't normally exist)
    const sortedNodes = [...nodesWithValidPosition, ...nodesWithoutPosition]

    // Build final array with sequence numbers
    const inputImages: WorkflowImage[] = sortedNodes.map((item, index) => ({
      url: item.url,
      mediaType: item.mediaType,
      sequenceNumber: sortedNodes.length >= 2 ? index + 1 : undefined
    }))

    return inputImages
  } catch (error) {
    console.error('[image-utils] Error getting input images:', {
      nodeId,
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString()
    })
    // Return empty array as safe fallback
    return []
  }
}

/**
 * Gathers text inputs from connected code nodes for a given node
 */
function getTextInputsFromNodes(
  nodeId: string,
  nodes: { id: string; type?: string; data: Record<string, unknown> }[],
  edges: { source: string; target: string }[],
): WorkflowTextInput[] {
  const incomingEdges = edges.filter((e) => e.target === nodeId)
  const inputNodeIds = incomingEdges.map((e) => e.source)

  const textInputs: WorkflowTextInput[] = []

  for (const inputId of inputNodeIds) {
    const inputNode = nodes.find((n) => n.id === inputId)

    if (!inputNode) continue

    // Collect text from code nodes
    if (inputNode.type === "codeNode" && inputNode.data.content) {
      const content = inputNode.data.content as string
      const language = inputNode.data.language as string | undefined
      const label = inputNode.data.label as string | undefined

      textInputs.push({
        content,
        language,
        label: label || "Code Input"
      })
    }

    // Collect text from text input nodes
    if (inputNode.type === "textInputNode" && inputNode.data.value) {
      const content = inputNode.data.value as string
      const label = inputNode.data.label as string | undefined

      textInputs.push({
        content,
        label: label || "Text Input"
      })
    }

    // Collect text from prompt nodes (for chaining text outputs)
    // This allows prompt nodes to pass their text output to downstream nodes
    if (inputNode.type === "promptNode" && inputNode.data.lastTextOutput) {
      const content = inputNode.data.lastTextOutput as string
      const label = inputNode.data.title as string | undefined

      textInputs.push({
        content,
        label: label || "Text Input"
      })
    }
  }

  return textInputs
}

/**
 * Gathers all inputs (images and text) from connected nodes for a given node
 */
export function getAllInputsFromNodes(
  nodeId: string,
  nodes: { id: string; type?: string; data: Record<string, unknown> }[],
  edges: { source: string; target: string }[],
): { images: WorkflowImage[]; textInputs: WorkflowTextInput[] } {
  return {
    images: getInputImagesFromNodes(nodeId, nodes, edges),
    textInputs: getTextInputsFromNodes(nodeId, nodes, edges),
  }
}
