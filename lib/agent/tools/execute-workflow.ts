/**
 * Execute Workflow Tool
 * 
 * Allows the agent to trigger workflow execution on the canvas.
 * Requires explicit confirmation from the user before executing.
 */

import { z } from "zod"
import type { ExecuteWorkflowResult } from "../types"

// Schema for the tool parameters
export const executeWorkflowSchema = z.object({
  confirm: z.boolean().describe("Set to true only after user explicitly confirms they want to execute the workflow"),
})

export type ExecuteWorkflowParams = z.infer<typeof executeWorkflowSchema>

/**
 * Execute the executeWorkflow tool
 */
export async function executeExecuteWorkflow(
  params: ExecuteWorkflowParams
): Promise<ExecuteWorkflowResult> {
  const { confirm } = params

  if (!confirm) {
    return {
      success: true,
      status: "awaiting_confirmation",
      message: "Workflow is ready. Ask the user to confirm before executing.",
    }
  }

  // Return success - the actual execution happens client-side via bridge
  return {
    success: true,
    status: "executed",
    message: "Workflow execution started.",
  }
}

/**
 * Tool description for the AI model
 */
export const executeWorkflowDescription = `Execute the current workflow. This will run all prompt nodes in the workflow in dependency order.

IMPORTANT: Always ask for user confirmation before executing:
1. First call with confirm: false to prepare and ask the user
2. Only call with confirm: true after user explicitly agrees

The workflow will validate before running and show any errors.
Nodes are executed in parallel where possible (when they have no dependencies on each other).`
