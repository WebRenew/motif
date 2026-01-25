import { useCallback } from "react"
import type { Node, Edge } from "@xyflow/react"
import { toast } from "sonner"
import { validateWorkflow } from "@/lib/workflow/validation"
import { topologicalSort, getPromptDependencies, CycleDetectedError } from "@/lib/workflow/topological-sort"
import { getInputImagesFromNodes } from "@/lib/workflow/image-utils"
import type { NodeExecutionResult } from "./use-node-execution"
import type { WorkflowImage } from "@/lib/types/workflow"
import { logger } from "@/lib/logger"

type UseWorkflowExecutionParams = {
  nodesRef: React.RefObject<Node[]>
  edgesRef: React.RefObject<Edge[]>
  isInitialized: boolean
  isExecutingRef: React.RefObject<boolean>
  setIsExecuting: (value: boolean) => void
  handleRunNode: (
    nodeId: string,
    prompt: string,
    model: string,
    inputImages?: WorkflowImage[]
  ) => Promise<NodeExecutionResult | void>
}

/**
 * Computes execution levels for nodes based on their dependencies.
 * Nodes at the same level can be executed in parallel.
 */
function computeNodeLevels(
  nodes: Node[],
  getDeps: (id: string) => string[]
): Map<Node, number> {
  const levels = new Map<Node, number>()
  const computed = new Set<string>()

  const computeLevel = (node: Node): number => {
    if (computed.has(node.id)) return levels.get(node)!

    const deps = getDeps(node.id)
    if (deps.length === 0) {
      levels.set(node, 0)
      computed.add(node.id)
      return 0
    }

    let maxDepLevel = -1
    for (const depId of deps) {
      const depNode = nodes.find((n) => n.id === depId)
      if (depNode) {
        const depLevel = computeLevel(depNode)
        maxDepLevel = Math.max(maxDepLevel, depLevel)
      }
    }

    const level = maxDepLevel + 1
    levels.set(node, level)
    computed.add(node.id)
    return level
  }

  nodes.forEach((node) => computeLevel(node))
  return levels
}

/**
 * Hook that handles running an entire workflow (all prompt nodes in dependency order).
 * Manages:
 * - Workflow validation before execution
 * - Topological sorting with cycle detection
 * - Parallel execution of independent nodes at each dependency level
 * - Execution lock to prevent concurrent runs
 * - Progress tracking and completion notifications
 */
export function useWorkflowExecution({
  nodesRef,
  edgesRef,
  isInitialized,
  isExecutingRef,
  setIsExecuting,
  handleRunNode,
}: UseWorkflowExecutionParams) {
  /**
   * Run the entire workflow, executing prompt nodes in dependency order.
   * Nodes at the same dependency level are executed in parallel.
   */
  const runWorkflow = useCallback(async () => {
    if (!isInitialized) return

    // Prevent concurrent workflow execution
    if (isExecutingRef.current) {
      toast.info("Workflow is already running")
      return
    }

    // Set execution lock to prevent state mutations during async execution
    setIsExecuting(true)

    try {
      const currentNodes = [...nodesRef.current]
      const currentEdges = [...edgesRef.current]

      // Validate the entire workflow before running
      const validationResult = validateWorkflow(currentNodes, currentEdges)

      if (!validationResult.valid) {
        const errorMessages = validationResult.errors
          .filter((e) => e.type === "error")
          .map((e) => e.message)

        toast.error("Cannot run workflow", {
          description: errorMessages.join("; "),
        })
        return
      }

      // Show warnings if any
      const warnings = validationResult.errors.filter((e) => e.type === "warning")
      if (warnings.length > 0) {
        warnings.forEach((warning) => {
          toast.warning(warning.message, {
            description: warning.details,
          })
        })
      }

      const promptNodes = currentNodes.filter((n) => n.type === "promptNode")
      const getDeps = (id: string) => getPromptDependencies(id, currentNodes, currentEdges)

      // Compute execution order with cycle detection
      let executionOrder: Node[]
      try {
        executionOrder = topologicalSort(promptNodes, getDeps)
      } catch (error) {
        if (error instanceof CycleDetectedError) {
          // Find node titles for user-friendly message
          const cycleNodeTitles = error.cycleNodeIds.map((id) => {
            const node = currentNodes.find((n) => n.id === id)
            return (node?.data?.title as string) || id
          })
          toast.error("Circular dependency detected", {
            description: `Workflow cannot execute: ${cycleNodeTitles.join(" → ")}`,
            duration: 8000,
          })
          logger.error('Cycle detected', {
            cycleNodeIds: error.cycleNodeIds,
            cycleNodeTitles,
          })
          return
        }
        throw error // Re-throw unexpected errors
      }

      const nodeLevels = computeNodeLevels(executionOrder, getDeps)
      const levelGroups = new Map<number, Node[]>()

      // Group nodes by level
      executionOrder.forEach((node) => {
        const level = nodeLevels.get(node)!
        if (!levelGroups.has(level)) {
          levelGroups.set(level, [])
        }
        levelGroups.get(level)!.push(node)
      })

      const sortedLevels = Array.from(levelGroups.keys()).sort((a, b) => a - b)

      let completedCount = 0
      let failedNode: string | null = null

      // Execute nodes level by level, parallelizing independent nodes at each level
      for (const level of sortedLevels) {
        const nodesAtLevel = levelGroups.get(level)!

        // Execute all nodes at this level in parallel
        const results = await Promise.allSettled(
          nodesAtLevel.map(async (promptNode) => {
            // Use live refs instead of stale snapshot to get freshly generated upstream outputs
            const inputImages = getInputImagesFromNodes(
              promptNode.id,
              nodesRef.current,
              edgesRef.current
            )

            await handleRunNode(
              promptNode.id,
              promptNode.data.prompt as string,
              promptNode.data.model as string,
              inputImages
            )

            return {
              nodeId: promptNode.id,
              title: (promptNode.data.title as string) || "Untitled",
            }
          })
        )

        // Check for failures at this level
        for (let i = 0; i < results.length; i++) {
          const result = results[i]
          if (result.status === "fulfilled") {
            completedCount++
          } else {
            const node = nodesAtLevel[i]
            failedNode = (node.data.title as string) || "Untitled"
            logger.error('Node execution failed', {
              nodeId: node.id,
              nodeTitle: failedNode,
              error:
                result.reason instanceof Error ? result.reason.message : String(result.reason),
              completedCount,
              totalNodes: executionOrder.length,
              level,
            })
            // Stop execution if any node at this level fails
            break
          }
        }

        // If any node failed, stop the workflow
        if (failedNode) break
      }

      // Show completion status
      if (failedNode) {
        toast.error("Workflow stopped", {
          description: `Failed at node "${failedNode}". ${completedCount} of ${executionOrder.length} nodes completed.`,
        })
      } else if (completedCount > 0) {
        toast.success("Workflow completed", {
          description: `Successfully generated ${completedCount} ${completedCount === 1 ? "node" : "nodes"}.`,
        })
      }
    } finally {
      // Always release execution lock, even if workflow errors
      setIsExecuting(false)
    }
  }, [isInitialized, isExecutingRef, setIsExecuting, nodesRef, edgesRef, handleRunNode])

  return { runWorkflow }
}
