import type { WorkflowImage } from "@/lib/types/workflow"

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
