/**
 * Create Node Tool
 * 
 * AI SDK tool for creating nodes on the workflow canvas.
 * Returns a pending action that the client executes via the agent bridge.
 */

import { z } from 'zod'
import type { NodeType, Position, CreateNodeResult, ToolError } from '../types'

// Default positions for new nodes (staggered to avoid overlap)
const DEFAULT_POSITIONS: Record<NodeType, Position> = {
  imageNode: { x: 100, y: 200 },
  promptNode: { x: 400, y: 200 },
  codeNode: { x: 700, y: 200 },
  textInputNode: { x: 100, y: 400 },
  stickyNoteNode: { x: 100, y: 50 },
  captureNode: { x: 100, y: 600 },
}

// Schema for the tool parameters
export const createNodeSchema = z.object({
  nodeType: z.enum([
    'imageNode',
    'promptNode', 
    'codeNode',
    'textInputNode',
    'stickyNoteNode',
    'captureNode',
  ]).describe('The type of node to create'),
  
  position: z.object({
    x: z.number().describe('X coordinate on the canvas'),
    y: z.number().describe('Y coordinate on the canvas'),
  }).optional().describe('Position on the canvas. If not provided, uses a sensible default based on node type.'),
  
  // Node-specific data
  prompt: z.string().optional().describe('For promptNode: the AI prompt text'),
  outputType: z.enum(['image', 'text']).optional().describe('For promptNode: whether it generates images or text'),
  model: z.string().optional().describe('For promptNode: the AI model to use (e.g., "google/gemini-3-pro-image", "anthropic/claude-sonnet-4-5")'),
  
  imageUrl: z.string().optional().describe('For imageNode: URL of an existing image'),
  
  content: z.string().optional().describe('For codeNode or stickyNoteNode: initial content'),
  language: z.enum(['css', 'tsx', 'json', 'html', 'javascript', 'typescript', 'markdown']).optional()
    .describe('For codeNode: the code language'),
  
  label: z.string().optional().describe('For textInputNode: the input label'),
  value: z.string().optional().describe('For textInputNode: initial value'),
  
  color: z.enum(['yellow', 'pink', 'blue', 'green', 'purple', 'orange']).optional()
    .describe('For stickyNoteNode: note color'),
  
  url: z.string().optional().describe('For captureNode: URL to capture animation from'),
  selector: z.string().optional().describe('For captureNode: CSS selector for the element to capture'),
  duration: z.number().min(1).max(10).optional().describe('For captureNode: capture duration in seconds'),
})

export type CreateNodeParams = z.infer<typeof createNodeSchema>

/**
 * Build node data based on type and provided parameters
 */
function buildNodeData(params: CreateNodeParams): Record<string, unknown> {
  const { nodeType } = params
  
  switch (nodeType) {
    case 'imageNode':
      return {
        imageUrl: params.imageUrl || '',
        aspect: 'landscape',
        isInput: true,
      }
      
    case 'promptNode':
      return {
        title: params.outputType === 'text' ? 'Text Generation' : 'Image Generation',
        prompt: params.prompt || '',
        model: params.model || (params.outputType === 'text' 
          ? 'anthropic/claude-sonnet-4-5' 
          : 'google/gemini-3-pro-image'),
        outputType: params.outputType || 'image',
        status: 'idle',
      }
      
    case 'codeNode':
      return {
        content: params.content || '',
        language: params.language || 'css',
      }
      
    case 'textInputNode':
      return {
        value: params.value || '',
        label: params.label || 'Text Input',
        inputType: 'text',
        required: false,
      }
      
    case 'stickyNoteNode':
      return {
        content: params.content || '',
        color: params.color || 'yellow',
        fontSize: 'md',
      }
      
    case 'captureNode':
      return {
        url: params.url || '',
        selector: params.selector || '',
        duration: params.duration || 6,
        status: 'idle',
        progress: 0,
        currentFrame: 0,
        totalFrames: 30,
        excludedFrames: [],
      }
      
    default:
      return {}
  }
}

/**
 * Execute the createNode tool
 * Returns a result that will be sent to the client for execution
 */
export async function executeCreateNode(
  params: CreateNodeParams
): Promise<CreateNodeResult | ToolError> {
  const { nodeType, position } = params
  
  // Generate a unique node ID
  const nodeId = `${nodeType.replace('Node', '')}-${crypto.randomUUID()}`
  
  // Use provided position or default
  const finalPosition = position || DEFAULT_POSITIONS[nodeType]
  
  // Build the node data
  const data = buildNodeData(params)
  
  // Return the action for the client to execute
  // The actual node creation happens on the client via the bridge
  return {
    success: true,
    nodeId,
    nodeType,
    position: finalPosition,
    // Include data for client-side creation
    ...({ data } as Record<string, unknown>),
  } as CreateNodeResult & { data: Record<string, unknown> }
}

/**
 * Tool description for the AI model
 */
export const createNodeDescription = `Create a new node on the workflow canvas.

Available node types:
- imageNode: For uploading or displaying images. Use as inputs to prompt nodes.
- promptNode: AI operations - can generate images or text based on connected inputs.
- codeNode: Displays generated code (CSS, React, JSON, etc.) from text generation.
- textInputNode: Simple text input field for user-provided values.
- stickyNoteNode: Annotation/comment node (doesn't connect to workflow).
- captureNode: Records animations from web pages.

Common workflow patterns:
1. Image generation: imageNode → promptNode (outputType: "image") → imageNode (output)
2. Code generation: imageNode → promptNode (outputType: "text") → codeNode
3. Multi-image synthesis: multiple imageNodes → promptNode → output

Always position nodes left-to-right to represent the data flow direction.
Typical X spacing between connected nodes: 400px.`
