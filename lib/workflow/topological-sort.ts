import type { Node } from "@xyflow/react"

/**
 * Performs topological sort on prompt nodes based on their dependencies
 */
export function topologicalSort(nodes: Node[], getDependencies: (nodeId: string) => string[]): Node[] {
  const sortedNodes: Node[] = []
  const visited = new Set<string>()

  const visit = (node: Node) => {
    if (visited.has(node.id)) return
    visited.add(node.id)

    const dependencies = getDependencies(node.id)
    for (const dep of dependencies) {
      const depNode = nodes.find((n) => n.id === dep)
      if (depNode) visit(depNode)
    }

    sortedNodes.push(node)
  }

  for (const node of nodes) {
    visit(node)
  }

  return sortedNodes
}

/**
 * Gets prompt node dependencies by analyzing edges and intermediate image nodes
 */
export function getPromptDependencies(
  promptNodeId: string,
  nodes: Node[],
  edges: { source: string; target: string }[],
): string[] {
  const incomingEdges = edges.filter((e) => e.target === promptNodeId)
  const deps: string[] = []

  for (const edge of incomingEdges) {
    const sourceNode = nodes.find((n) => n.id === edge.source)
    if (sourceNode?.type === "promptNode") {
      deps.push(sourceNode.id)
    }
    if (sourceNode?.type === "imageNode") {
      // Check if this image node has a prompt node as input
      const incomingToImage = edges.filter((e) => e.target === sourceNode.id)
      for (const imgEdge of incomingToImage) {
        const imgSource = nodes.find((n) => n.id === imgEdge.source)
        if (imgSource?.type === "promptNode") {
          deps.push(imgSource.id)
        }
      }
    }
  }

  return [...new Set(deps)]
}
