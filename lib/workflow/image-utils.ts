import type { WorkflowImage, WorkflowTextInput } from "@/lib/types/workflow"

/**
 * Detects media type from URL or returns default PNG
 */
export function detectMediaType(url: string): string {
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
 * Gathers input images from connected nodes for a given node
 */
export function getInputImagesFromNodes(
  nodeId: string,
  nodes: { id: string; type?: string; data: Record<string, unknown> }[],
  edges: { source: string; target: string }[],
): WorkflowImage[] {
  const incomingEdges = edges.filter((e) => e.target === nodeId)
  const inputNodeIds = incomingEdges.map((e) => e.source)

  const inputImages: WorkflowImage[] = []

  for (const inputId of inputNodeIds) {
    const inputNode = nodes.find((n) => n.id === inputId)

    if (!inputNode) continue

    if (inputNode.type === "imageNode" && inputNode.data.imageUrl) {
      const url = inputNode.data.imageUrl as string
      const mediaType = detectMediaType(url)
      inputImages.push({ url, mediaType })
    }
  }

  return inputImages
}

export const getInputImagesForNode = getInputImagesFromNodes

/**
 * Gathers text inputs from connected code nodes for a given node
 */
export function getTextInputsFromNodes(
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
