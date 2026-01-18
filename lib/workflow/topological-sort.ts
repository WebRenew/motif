import type { Node } from "@xyflow/react"

/**
 * Error thrown when a cycle is detected in the workflow graph
 */
export class CycleDetectedError extends Error {
  readonly cycleNodeIds: string[]
  
  constructor(cycleNodeIds: string[]) {
    const nodeList = cycleNodeIds.join(" → ")
    super(`Cycle detected in workflow: ${nodeList}`)
    this.name = "CycleDetectedError"
    this.cycleNodeIds = cycleNodeIds
  }
}

/**
 * Performs topological sort on prompt nodes based on their dependencies.
 * Uses DFS with cycle detection via "visiting" and "visited" sets.
 * 
 * @throws {CycleDetectedError} if a cycle is detected in the graph
 */
export function topologicalSort(nodes: Node[], getDependencies: (nodeId: string) => string[]): Node[] {
  const sortedNodes: Node[] = []
  const visiting = new Set<string>()  // Nodes currently in DFS recursion path
  const visited = new Set<string>()   // Nodes completely processed

  const visit = (node: Node, path: string[] = []): void => {
    // Cycle detected: node is already in current recursion path
    if (visiting.has(node.id)) {
      const cycleStart = path.indexOf(node.id)
      const cyclePath = [...path.slice(cycleStart), node.id]
      throw new CycleDetectedError(cyclePath)
    }
    
    // Already fully processed, skip
    if (visited.has(node.id)) return
    
    // Mark as currently visiting (in recursion path)
    visiting.add(node.id)
    const currentPath = [...path, node.id]

    const dependencies = getDependencies(node.id)
    for (const dep of dependencies) {
      const depNode = nodes.find((n) => n.id === dep)
      if (depNode) visit(depNode, currentPath)
    }

    // Done visiting: move from visiting to visited
    visiting.delete(node.id)
    visited.add(node.id)
    sortedNodes.push(node)
  }

  for (const node of nodes) {
    visit(node, [])
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
