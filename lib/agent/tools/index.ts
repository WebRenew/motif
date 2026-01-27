/**
 * Agent Tools Registry
 *
 * Exports all available tools for the workflow agent.
 * These tools use the Vercel AI SDK tool format.
 */

import { tool } from 'ai'
import {
  createNodeSchema,
  executeCreateNode,
  createNodeDescription,
} from './create-node'
import {
  connectNodesSchema,
  executeConnectNodes,
  connectNodesDescription,
} from './connect-nodes'
import {
  deleteNodeSchema,
  executeDeleteNode,
  deleteNodeDescription,
} from './delete-node'
import {
  executeWorkflowSchema,
  executeExecuteWorkflow,
  executeWorkflowDescription,
} from './execute-workflow'
import {
  getCanvasStateSchema,
  executeGetCanvasState,
  getCanvasStateDescription,
} from './get-canvas-state'

/**
 * Create the workflow tools object for use with streamText
 *
 * These tools return action objects that the client executes via the agent bridge.
 * The execute functions return results that are sent back to the model for context.
 */
export const workflowTools = {
  createNode: tool({
    description: createNodeDescription,
    inputSchema: createNodeSchema,
    execute: executeCreateNode,
  }),

  connectNodes: tool({
    description: connectNodesDescription,
    inputSchema: connectNodesSchema,
    execute: executeConnectNodes,
  }),

  deleteNode: tool({
    description: deleteNodeDescription,
    inputSchema: deleteNodeSchema,
    execute: executeDeleteNode,
  }),

  executeWorkflow: tool({
    description: executeWorkflowDescription,
    inputSchema: executeWorkflowSchema,
    execute: executeExecuteWorkflow,
  }),

  getCanvasState: tool({
    description: getCanvasStateDescription,
    inputSchema: getCanvasStateSchema,
    execute: executeGetCanvasState,
  }),
}

// Export individual items for testing
export {
  createNodeSchema,
  executeCreateNode,
  createNodeDescription,
  connectNodesSchema,
  executeConnectNodes,
  connectNodesDescription,
  deleteNodeSchema,
  executeDeleteNode,
  deleteNodeDescription,
  executeWorkflowSchema,
  executeExecuteWorkflow,
  executeWorkflowDescription,
  getCanvasStateSchema,
  executeGetCanvasState,
  getCanvasStateDescription,
}

// Export types
export type { CreateNodeParams } from './create-node'
export type { ConnectNodesParams } from './connect-nodes'
export type { DeleteNodeParams } from './delete-node'
export type { ExecuteWorkflowParams } from './execute-workflow'
export type { GetCanvasStateParams, CanvasStateResult } from './get-canvas-state'
export type { ExecuteWorkflowResult } from '../types'
