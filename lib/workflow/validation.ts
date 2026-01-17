/**
 * Workflow validation utilities for ensuring workflows are valid before execution
 */

import type { Node, Edge } from "@xyflow/react"

export interface ValidationError {
  type: "error" | "warning"
  message: string
  nodeId?: string
  details?: string
}

export interface ValidationResult {
  valid: boolean
  errors: ValidationError[]
}

/**
 * Type guard: checks if value is a string
 */
function isString(value: unknown): value is string {
  return typeof value === "string"
}

/**
 * Type guard: checks if node has a valid imageUrl in data
 */
function hasValidImageUrl(node: Node): boolean {
  const url = node.data.imageUrl
  return isString(url) && url.length > 0
}

/**
 * Type guard: checks if node has a valid prompt in data
 */
function hasValidPrompt(node: Node): boolean {
  const prompt = node.data.prompt
  return isString(prompt) && prompt.trim().length > 0
}

/**
 * Type guard: checks if node has a valid model in data
 */
function hasValidModel(node: Node): boolean {
  const model = node.data.model
  return isString(model) && model.length > 0
}

/**
 * Type guard: checks if node has valid content in data
 */
function hasValidContent(node: Node): boolean {
  const content = node.data.content
  return isString(content) && content.trim().length > 0
}

/**
 * Validates that an image URL is valid
 * Accepts:
 * - Data URLs (base64 encoded images)
 * - Local placeholder images (/placeholders/...)
 * - Supabase storage URLs (contain /storage/v1/object/)
 * - Any HTTP(S) URL with a valid image extension
 */
export function isValidImageUrl(url: string | null | undefined): boolean {
  if (!url || typeof url !== "string") return false

  // Check if it's a data URL
  if (url.startsWith("data:image/")) {
    return url.length > 50 // Minimal validation for data URLs
  }

  // Check if it's a local placeholder image
  if (url.startsWith("/placeholders/") || url.startsWith("/images/")) {
    return true
  }

  // Validate HTTP(S) URLs
  try {
    const urlObj = new URL(url)

    // Must be HTTP or HTTPS protocol
    if (urlObj.protocol !== "http:" && urlObj.protocol !== "https:") {
      return false
    }

    // Accept Supabase storage URLs (we control these uploads)
    if (urlObj.pathname.includes("/storage/v1/object/")) {
      return true
    }

    // For other URLs, check for valid image extensions
    const validExtensions = [".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg", ".avif"]
    const pathname = urlObj.pathname.toLowerCase()
    return validExtensions.some(ext => pathname.endsWith(ext))
  } catch {
    return false
  }
}

/**
 * Validates that an image node has a valid image
 */
export function validateImageNode(node: Node): ValidationError[] {
  const errors: ValidationError[] = []

  // Defensive: check node.data exists
  if (!node.data || typeof node.data !== "object") {
    errors.push({
      type: "error",
      message: "Image node has corrupted data",
      nodeId: node.id,
      details: "Node data is missing or invalid"
    })
    return errors
  }

  if (!hasValidImageUrl(node)) {
    errors.push({
      type: "error",
      message: `Image node "${node.data.label || "Untitled"}" has no image`,
      nodeId: node.id,
      details: "Please upload an image before running the workflow"
    })
  } else {
    // Additional validation: check if the URL structure is valid
    const imageUrl = node.data.imageUrl as string
    if (!isValidImageUrl(imageUrl)) {
      errors.push({
        type: "error",
        message: `Image node "${node.data.label || "Untitled"}" has an invalid image`,
        nodeId: node.id,
        details: "The image URL or data is not valid"
      })
    }
  }

  return errors
}

/**
 * Validates that a prompt node has required fields
 */
export function validatePromptNode(node: Node): ValidationError[] {
  const errors: ValidationError[] = []

  // Defensive: check node.data exists
  if (!node.data || typeof node.data !== "object") {
    errors.push({
      type: "error",
      message: "Prompt node has corrupted data",
      nodeId: node.id,
      details: "Node data is missing or invalid"
    })
    return errors
  }

  if (!hasValidPrompt(node)) {
    errors.push({
      type: "error",
      message: `Prompt node "${node.data.title || "Untitled"}" has no prompt`,
      nodeId: node.id,
      details: "Please enter a prompt before running"
    })
  }

  if (!hasValidModel(node)) {
    errors.push({
      type: "error",
      message: `Prompt node "${node.data.title || "Untitled"}" has no model selected`,
      nodeId: node.id,
      details: "Please select a model"
    })
  }

  return errors
}

/**
 * Validates that a code node has content when used as input
 */
export function validateCodeNode(node: Node): ValidationError[] {
  const errors: ValidationError[] = []

  // Defensive: check node.data exists
  if (!node.data || typeof node.data !== "object") {
    errors.push({
      type: "error",
      message: "Code node has corrupted data",
      nodeId: node.id,
      details: "Node data is missing or invalid"
    })
    return errors
  }

  if (!hasValidContent(node)) {
    errors.push({
      type: "error",
      message: `Code node "${node.data.label || "Output"}" is empty`,
      nodeId: node.id,
      details: "This code node is being used as input but has no content"
    })
  }

  return errors
}

/**
 * Checks if a node has any outgoing connections
 */
export function hasOutgoingConnections(nodeId: string, edges: Edge[]): boolean {
  return edges.some(edge => edge.source === nodeId)
}

/**
 * Checks if a node has any incoming connections
 */
export function hasIncomingConnections(nodeId: string, edges: Edge[]): boolean {
  return edges.some(edge => edge.target === nodeId)
}

/**
 * Gets all downstream nodes from a given node (nodes that depend on this node)
 */
export function getDownstreamNodes(nodeId: string, nodes: Node[], edges: Edge[]): Node[] {
  const downstreamIds = new Set<string>()
  const visited = new Set<string>()

  const traverse = (currentId: string) => {
    if (visited.has(currentId)) return
    visited.add(currentId)

    const outgoingEdges = edges.filter(edge => edge.source === currentId)

    for (const edge of outgoingEdges) {
      downstreamIds.add(edge.target)
      traverse(edge.target)
    }
  }

  traverse(nodeId)

  return nodes.filter(node => downstreamIds.has(node.id))
}

/**
 * Checks if a node eventually connects to an output node (imageNode or codeNode)
 */
export function hasPathToOutput(nodeId: string, nodes: Node[], edges: Edge[]): boolean {
  const downstreamNodes = getDownstreamNodes(nodeId, nodes, edges)

  // Check if any downstream node is an output node
  return downstreamNodes.some(node =>
    node.type === "imageNode" || node.type === "codeNode"
  )
}

/**
 * Detects circular dependencies in the workflow
 */
export function detectCircularDependencies(nodes: Node[], edges: Edge[]): ValidationError[] {
  const errors: ValidationError[] = []
  const visited = new Set<string>()
  const recursionStack = new Set<string>()

  const hasCycle = (nodeId: string, path: string[]): boolean => {
    visited.add(nodeId)
    recursionStack.add(nodeId)

    const outgoingEdges = edges.filter(edge => edge.source === nodeId)
    let foundCycle = false // Track if we found a cycle

    for (const edge of outgoingEdges) {
      const targetId = edge.target

      if (!visited.has(targetId)) {
        // Don't return early - continue checking
        if (hasCycle(targetId, [...path, targetId])) {
          foundCycle = true
        }
      } else if (recursionStack.has(targetId)) {
        const cycleStart = path.indexOf(targetId)
        const cycle = path.slice(cycleStart).concat(targetId)
        const cycleNodes = cycle.map(id => {
          const node = nodes.find(n => n.id === id)
          return node?.data.title || node?.data.label || id
        })

        errors.push({
          type: "error",
          message: "Circular dependency detected",
          details: `Cycle: ${cycleNodes.join(" → ")}`
        })
        foundCycle = true
        // Don't return here - keep checking
      }
    }

    recursionStack.delete(nodeId)
    return foundCycle
  }

  for (const node of nodes) {
    if (!visited.has(node.id)) {
      hasCycle(node.id, [node.id])
    }
  }

  return errors
}

/**
 * Validates the entire workflow before execution
 */
export function validateWorkflow(nodes: Node[], edges: Edge[]): ValidationResult {
  const errors: ValidationError[] = []

  // Check for circular dependencies first
  const circularErrors = detectCircularDependencies(nodes, edges)

  // If there are circular dependencies, create a summary error and stop validation
  if (circularErrors.length > 0) {
    const summary = circularErrors.length === 1
      ? "1 circular dependency detected"
      : `${circularErrors.length} circular dependencies detected`

    errors.push({
      type: "error",
      message: summary,
      details: circularErrors.map(e => e.details).join("; ")
    })

    return { valid: false, errors }
  }

  // Validate each node
  for (const node of nodes) {
    if (node.type === "imageNode") {
      // Only validate image nodes that are used as inputs (have outgoing connections)
      if (hasOutgoingConnections(node.id, edges)) {
        const nodeErrors = validateImageNode(node)
        errors.push(...nodeErrors)
      }
    } else if (node.type === "promptNode") {
      const nodeErrors = validatePromptNode(node)
      errors.push(...nodeErrors)

      // Check if prompt node has path to output
      if (!hasPathToOutput(node.id, nodes, edges)) {
        errors.push({
          type: "warning",
          message: `Prompt node "${node.data.title || "Untitled"}" has no output`,
          nodeId: node.id,
          details: "This node doesn't connect to any output (image or code node)"
        })
      }
    }
  }

  // Check if there are any prompt nodes at all
  const promptNodes = nodes.filter(n => n.type === "promptNode")
  if (promptNodes.length === 0) {
    errors.push({
      type: "error",
      message: "No prompt nodes in workflow",
      details: "Add at least one prompt node to run the workflow"
    })
  }

  return {
    valid: errors.filter(e => e.type === "error").length === 0,
    errors
  }
}

/**
 * Detects the language suggested by the prompt text
 * Returns the detected language or null if no clear language is detected
 */
function detectLanguageFromPrompt(prompt: string): string | null {
  const lowerPrompt = prompt.toLowerCase()

  if (lowerPrompt.includes('typescript') || lowerPrompt.includes('tsx') || lowerPrompt.includes('react component')) {
    return 'tsx'
  }
  if (lowerPrompt.includes('css') || lowerPrompt.includes('stylesheet') || lowerPrompt.includes('styling')) {
    return 'css'
  }
  if (lowerPrompt.includes('json') || lowerPrompt.includes('config')) {
    return 'json'
  }
  if (lowerPrompt.includes('html')) {
    return 'html'
  }

  return null  // Can't detect language
}

/**
 * Validates a single prompt node before execution
 */
export function validatePromptNodeForExecution(
  nodeId: string,
  nodes: Node[],
  edges: Edge[]
): ValidationResult {
  const errors: ValidationError[] = []

  const node = nodes.find(n => n.id === nodeId)

  if (!node) {
    errors.push({
      type: "error",
      message: "Node not found",
      nodeId
    })
    return { valid: false, errors }
  }

  // Validate the prompt node itself
  if (node.type === "promptNode") {
    const nodeErrors = validatePromptNode(node)
    errors.push(...nodeErrors)

    // Validate input nodes (images and code)
    const incomingEdges = edges.filter(edge => edge.target === nodeId)
    const inputNodeIds = incomingEdges.map(edge => edge.source)

    for (const inputId of inputNodeIds) {
      const inputNode = nodes.find(n => n.id === inputId)

      if (inputNode?.type === "imageNode") {
        const imageErrors = validateImageNode(inputNode)
        errors.push(...imageErrors)
      } else if (inputNode?.type === "codeNode") {
        // Only validate code nodes if they have outgoing connections (being used as input)
        const codeErrors = validateCodeNode(inputNode)
        errors.push(...codeErrors)
      }
    }

    // Check if it has path to output
    if (!hasPathToOutput(nodeId, nodes, edges)) {
      errors.push({
        type: "warning",
        message: `Prompt node "${node.data.title || "Untitled"}" has no output`,
        nodeId,
        details: "This node doesn't connect to any output (image or code node)"
      })
    }

    // Check for language mismatches
    const outgoingEdges = edges.filter(edge => edge.source === nodeId)
    const outputNodes = outgoingEdges
      .map(edge => nodes.find(n => n.id === edge.target))
      .filter((n): n is Node => n !== undefined && n.type === "codeNode")

    for (const outputNode of outputNodes) {
      // Defensive: check node.data exists
      if (!outputNode.data || typeof outputNode.data !== "object") {
        continue
      }

      const expectedLang = isString(outputNode.data.language) ? outputNode.data.language : undefined

      // Check if prompt suggests different language
      const promptText = hasValidPrompt(node) ? node.data.prompt as string : ""
      const promptSuggests = detectLanguageFromPrompt(promptText.toLowerCase())

      if (expectedLang && promptSuggests && expectedLang !== promptSuggests) {
        errors.push({
          type: "warning",
          message: `Language mismatch for "${outputNode.data.label || 'Output'}"`,
          nodeId: outputNode.id,
          details: `Output expects ${expectedLang} but prompt suggests ${promptSuggests}`
        })
      }
    }
  }

  return {
    valid: errors.filter(e => e.type === "error").length === 0,
    errors
  }
}
