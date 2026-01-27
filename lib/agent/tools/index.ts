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
import {
  searchIconsSchema,
  executeSearchIcons,
  searchIconsDescription,
  getIconSchema,
  executeGetIcon,
  getIconDescription,
  getMultipleIconsSchema,
  executeGetMultipleIcons,
  getMultipleIconsDescription,
  listLibrariesSchema,
  executeListLibraries,
  listLibrariesDescription,
  listCategoriesSchema,
  executeListCategories,
  listCategoriesDescription,
  getStarterPackSchema,
  executeGetStarterPack,
  getStarterPackDescription,
} from './unicon'

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

  // Unicon icon tools
  searchIcons: tool({
    description: searchIconsDescription,
    inputSchema: searchIconsSchema,
    execute: executeSearchIcons,
  }),

  getIcon: tool({
    description: getIconDescription,
    inputSchema: getIconSchema,
    execute: executeGetIcon,
  }),

  getMultipleIcons: tool({
    description: getMultipleIconsDescription,
    inputSchema: getMultipleIconsSchema,
    execute: executeGetMultipleIcons,
  }),

  listIconLibraries: tool({
    description: listLibrariesDescription,
    inputSchema: listLibrariesSchema,
    execute: executeListLibraries,
  }),

  listIconCategories: tool({
    description: listCategoriesDescription,
    inputSchema: listCategoriesSchema,
    execute: executeListCategories,
  }),

  getIconStarterPack: tool({
    description: getStarterPackDescription,
    inputSchema: getStarterPackSchema,
    execute: executeGetStarterPack,
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
