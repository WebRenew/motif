/**
 * Connection validation rules for workflow nodes
 */

import type { Node, Edge, Connection } from "@xyflow/react"

export interface ConnectionValidationResult {
  valid: boolean
  error?: string
  errorDetails?: string
}

/**
 * Validates a connection between two nodes based on workflow rules
 *
 * Rules:
 * 1. No output-to-output connections (image→image, image→code, code→code, code→image)
 * 2. Outputs can only connect TO prompt nodes (as inputs for future processing)
 * 3. Prompt nodes can only connect FROM outputs or other prompt nodes
 * 4. Prompt nodes can only have ONE output connection
 */
export function validateConnection(
  connection: Edge | Connection,
  nodes: Node[],
  edges: Edge[]
): ConnectionValidationResult {
  const sourceNode = nodes.find((n) => n.id === connection.source)
  const targetNode = nodes.find((n) => n.id === connection.target)

  if (!sourceNode || !targetNode) {
    return {
      valid: false,
      error: "Invalid connection",
      errorDetails: "Source or target node not found"
    }
  }

  const sourceType = sourceNode.type
  const targetType = targetNode.type

  // Rule 1: Prevent output-to-output connections
  const outputTypes = ["imageNode", "codeNode"]

  if (outputTypes.includes(sourceType || "") && outputTypes.includes(targetType || "")) {
    return {
      valid: false,
      error: "Cannot connect outputs directly",
      errorDetails: "Output nodes (images/code) can only connect to prompt nodes. Use a prompt node to transform or iterate on outputs."
    }
  }

  // Rule 2: Output nodes can only connect TO prompt nodes
  if (outputTypes.includes(sourceType || "") && targetType !== "promptNode") {
    return {
      valid: false,
      error: "Invalid connection target",
      errorDetails: `${sourceType === "imageNode" ? "Image" : "Code"} outputs can only connect to prompt nodes.`
    }
  }

  // Rule 3: Prompt nodes can only receive FROM outputs or other prompt nodes
  if (targetType === "promptNode") {
    const validSources = ["imageNode", "codeNode", "promptNode"]
    if (!validSources.includes(sourceType || "")) {
      return {
        valid: false,
        error: "Invalid connection source",
        errorDetails: "Prompt nodes can only receive connections from images, code, or other prompt nodes."
      }
    }
  }

  // Rule 4: Prompt nodes can have multiple image outputs (for variations)
  // but only ONE code output (code variations are less useful)
  if (sourceType === "promptNode" && targetType === "codeNode") {
    const existingCodeOutputs = edges.filter((e) => {
      const target = nodes.find((n) => n.id === e.target)
      return e.source === connection.source && target?.type === "codeNode"
    })

    if (existingCodeOutputs.length > 0) {
      return {
        valid: false,
        error: "Prompt nodes can only have one code output",
        errorDetails: "For code generation, use one output per prompt. For image variations, you can connect multiple image outputs."
      }
    }
  }

  // Rule 5: No self-connections
  if (connection.source === connection.target) {
    return {
      valid: false,
      error: "Cannot connect node to itself",
      errorDetails: "A node cannot connect to itself."
    }
  }

  // Connection is valid
  return { valid: true }
}

/**
 * Checks if a connection would create a valid workflow pattern
 */
export function isValidConnectionPattern(
  sourceType: string | undefined,
  targetType: string | undefined
): boolean {
  // Valid patterns:
  // imageNode → promptNode ✓
  // codeNode → promptNode ✓
  // promptNode → imageNode ✓
  // promptNode → codeNode ✓
  // promptNode → promptNode ✓

  if (!sourceType || !targetType) return false

  const validPatterns = [
    { source: "imageNode", target: "promptNode" },
    { source: "codeNode", target: "promptNode" },
    { source: "promptNode", target: "imageNode" },
    { source: "promptNode", target: "codeNode" },
    { source: "promptNode", target: "promptNode" },
  ]

  return validPatterns.some(
    (pattern) => pattern.source === sourceType && pattern.target === targetType
  )
}

/**
 * Gets all output connections for a given node
 */
export function getOutputConnections(nodeId: string, edges: Edge[]): Edge[] {
  return edges.filter((e) => e.source === nodeId)
}

/**
 * Gets all input connections for a given node
 */
export function getInputConnections(nodeId: string, edges: Edge[]): Edge[] {
  return edges.filter((e) => e.target === nodeId)
}

/**
 * Checks if a node has reached its maximum output connections
 * Currently no limits are imposed - users can add as many outputs as they want
 */
export function hasReachedMaxOutputs(
  _nodeId: string,
  _nodeType: string | undefined,
  _edges: Edge[],
  _nodes?: Node[]
): boolean {
  // No hard limits on outputs:
  // - Prompt nodes can have multiple image outputs (for variations)
  // - Prompt nodes can have multiple code outputs (for multi-file generation)
  // - All other node types also have no restrictions
  return false
}

/**
 * Gets a user-friendly description of valid targets for a node type
 */
export function getValidTargetsDescription(nodeType: string | undefined): string {
  switch (nodeType) {
    case "imageNode":
      return "Image outputs can connect to prompt nodes to be used as input for AI processing."
    case "codeNode":
      return "Code outputs can connect to prompt nodes to iterate and refine the generated code."
    case "promptNode":
      return "Prompt nodes can connect to multiple image nodes (for variations), one code node, or other prompt nodes."
    default:
      return "Unknown node type"
  }
}
