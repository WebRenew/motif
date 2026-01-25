import { useCallback, useRef } from "react"
import type { Node, Edge } from "@xyflow/react"
import type { WorkflowImage } from "@/lib/types/workflow"
import { toast } from "sonner"
import { validatePromptNodeForExecution } from "@/lib/workflow/validation"
import { getAllInputsFromNodes } from "@/lib/workflow/image-utils"
import { captureAnimation, formatAnimationContextAsMarkdown } from "@/lib/hooks/use-capture-animation"
import { logger } from "@/lib/logger"

/** Result from getTargetOutputType */
type TargetOutput = { language?: string; label?: string } | null

/** Response from generation API */
type GenerationResponse = {
  success: boolean
  text?: string
  structuredOutput?: object
  outputImage?: { url: string }
}

/** Result returned from handleRunNode */
export type NodeExecutionResult = {
  imageUrl?: string
  text?: string
}

/** Multi-file output structure */
type MultiFileOutput = {
  files?: Array<{ filename: string; language: string; content: string }>
}

type UseNodeExecutionParams = {
  nodesRef: React.RefObject<Node[]>
  edgesRef: React.RefObject<Edge[]>
  setNodes: React.Dispatch<React.SetStateAction<Node[]>>
  setEdges: React.Dispatch<React.SetStateAction<Edge[]>>
  userIdRef: React.RefObject<string | null>
  workflowId: React.RefObject<string>
}

/**
 * Determines the target output type (language) for a prompt node
 * by looking at connected code nodes
 */
function getTargetOutputType(
  promptNodeId: string,
  nodes: Node[],
  edges: Edge[]
): TargetOutput {
  const outputEdges = edges.filter((e) => e.source === promptNodeId)
  for (const edge of outputEdges) {
    const targetNode = nodes.find((n) => n.id === edge.target)
    if (targetNode?.type === "codeNode") {
      return {
        language: (targetNode.data.language as string) || "css",
        label: targetNode.data.label as string,
      }
    }
  }
  return null
}

/**
 * Hook that handles running individual nodes (prompt nodes).
 * Manages:
 * - Validation before execution
 * - AbortController lifecycle
 * - Fetch timeout handling
 * - Capture mode (animation capture) vs regular generation
 * - Parallel generation requests for multiple outputs
 * - Auto-creation of nodes for multi-file outputs
 * - Error handling and toast notifications
 */
export function useNodeExecution({
  nodesRef,
  edgesRef,
  setNodes,
  setEdges,
  userIdRef,
  workflowId,
}: UseNodeExecutionParams) {
  // Track AbortControllers per nodeId for fetch cancellation
  const abortControllersRef = useRef<Map<string, AbortController>>(new Map())

  /**
   * Run a single prompt node with its configured model and inputs.
   * Returns the generated output (imageUrl and/or text) or throws on failure.
   */
  const handleRunNode = useCallback(
    async (
      nodeId: string,
      prompt: string,
      model: string,
      inputImages?: WorkflowImage[]
    ): Promise<NodeExecutionResult | void> => {
      // Validate the node before running
      const validationResult = validatePromptNodeForExecution(
        nodeId,
        nodesRef.current,
        edgesRef.current
      )

      if (!validationResult.valid) {
        const errorMessages = validationResult.errors
          .filter((e) => e.type === "error")
          .map((e) => e.message)

        toast.error("Cannot run node", {
          description: errorMessages.join(", "),
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

      // Collect all inputs (images and text)
      const allInputs = getAllInputsFromNodes(nodeId, nodesRef.current, edgesRef.current)
      const imagesToSend = inputImages?.length ? inputImages : allInputs.images
      const textInputs = allInputs.textInputs

      const targetOutput = getTargetOutputType(nodeId, nodesRef.current, edgesRef.current)

      // Check if node exists before setting status (node could have been deleted between validation and execution)
      setNodes((prevNodes) => {
        const nodeExists = prevNodes.some((n) => n.id === nodeId)
        if (!nodeExists) {
          logger.warn('Cannot run deleted node', { nodeId })
          return prevNodes // No changes
        }

        return prevNodes.map((n) =>
          n.id === nodeId ? { ...n, data: { ...n.data, status: "running" } } : n
        )
      })

      // Verify node still exists after state update (defensive check)
      if (!nodesRef.current.some((n) => n.id === nodeId)) {
        // Clean up AbortController for deleted node to prevent memory leak
        const controller = abortControllersRef.current.get(nodeId)
        if (controller) {
          controller.abort()
          abortControllersRef.current.delete(nodeId)
        }
        toast.warning("Node was deleted during execution")
        return
      }

      const outputEdges = edgesRef.current.filter((e) => e.source === nodeId)

      // Separate image outputs from code outputs
      const imageOutputIds: string[] = []
      const codeOutputIds: string[] = []

      for (const edge of outputEdges) {
        const targetNode = nodesRef.current.find((n) => n.id === edge.target)
        if (targetNode?.type === "imageNode") {
          imageOutputIds.push(edge.target)
        } else if (targetNode?.type === "codeNode") {
          codeOutputIds.push(edge.target)
        }
      }

      // Abort any previous request for this specific node and create new AbortController
      const existingController = abortControllersRef.current.get(nodeId)
      if (existingController) {
        existingController.abort()
      }
      const newController = new AbortController()
      abortControllersRef.current.set(nodeId, newController)

      // Add timeout to prevent indefinite hanging (5 minutes matches server maxDuration)
      const FETCH_TIMEOUT_MS = 5 * 60 * 1000
      const timeoutId = setTimeout(() => {
        newController.abort()
        logger.warn('Request timed out', { nodeId, timeoutMs: FETCH_TIMEOUT_MS })
      }, FETCH_TIMEOUT_MS)
      const signal = newController.signal

      try {
        const results: { imageUrls: Map<string, string>; text?: string; structuredOutput?: object } =
          {
            imageUrls: new Map(),
          }

        // Check if this is a capture mode node (animation capture workflow)
        const currentNode = nodesRef.current.find((n) => n.id === nodeId)
        const isCaptureMode = currentNode?.data?.captureMode === true

        if (isCaptureMode) {
          // Animation capture mode - call capture API instead of generate-image
          // Extract URL and selector from text inputs
          const urlInput = textInputs.find((t) => t.label?.toLowerCase().includes("url"))
          const selectorInput = textInputs.find((t) => t.label?.toLowerCase().includes("selector"))

          if (!urlInput?.content) {
            throw new Error("Website URL is required for animation capture")
          }

          // Get user ID for the capture (must be authenticated)
          const userId = userIdRef.current
          if (!userId) {
            throw new Error("Authentication required for animation capture")
          }

          toast.info("Starting animation capture...", {
            description: `Capturing animations from ${urlInput.content}`,
            duration: 5000,
          })

          const captureResult = await captureAnimation(
            {
              url: urlInput.content,
              selector: selectorInput?.content || undefined,
              duration: 6000,
              userId,
            },
            {
              signal,
              onStatusChange: (status) => {
                if (status === "processing") {
                  toast.info("Processing capture...", {
                    description: "Browser session active, capturing animation frames",
                    duration: 10000,
                  })
                }
              },
            }
          )

          // Format the capture result as markdown for the output
          results.text = formatAnimationContextAsMarkdown(captureResult)

          toast.success("Animation captured!", {
            description: `Captured ${captureResult.animationContext?.frames?.length || 0} frames`,
          })
        } else {
          // Regular generation mode - Parallelize all generation requests (code + images)
          const generationPromises: Array<
            Promise<{ type: "code" | "image"; imageOutputId?: string; data: GenerationResponse }>
          > = []

          // Add code generation request
          if (codeOutputIds.length > 0) {
            generationPromises.push(
              fetch("/api/generate-image", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  prompt,
                  model,
                  images: imagesToSend,
                  textInputs,
                  targetLanguage: targetOutput?.language,
                  sessionId: workflowId.current,
                }),
                signal,
              }).then(async (response) => {
                const data = await response.json()
                if (response.status === 429) {
                  const resetTime = data.reset
                    ? new Date(data.reset).toLocaleTimeString()
                    : "soon"
                  throw new Error(
                    `${data.message || "Rate limit exceeded."} Please try again at ${resetTime}.`
                  )
                }
                if (!response.ok) {
                  throw new Error(
                    data.error || data.message || `HTTP ${response.status}: Generation failed`
                  )
                }
                return { type: "code" as const, data }
              })
            )
          }

          // Add image generation requests (all in parallel)
          for (const imageOutputId of imageOutputIds) {
            generationPromises.push(
              fetch("/api/generate-image", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  prompt,
                  model,
                  images: imagesToSend,
                  textInputs,
                  sessionId: workflowId.current,
                  // No targetLanguage - this is for image generation
                }),
                signal,
              }).then(async (response) => {
                const data = await response.json()
                if (response.status === 429) {
                  const resetTime = data.reset
                    ? new Date(data.reset).toLocaleTimeString()
                    : "soon"
                  throw new Error(
                    `${data.message || "Rate limit exceeded."} Please try again at ${resetTime}.`
                  )
                }
                if (!response.ok) {
                  throw new Error(
                    data.error || data.message || `HTTP ${response.status}: Generation failed`
                  )
                }
                return { type: "image" as const, imageOutputId, data }
              })
            )
          }

          // Execute all requests in parallel
          const settledResults = await Promise.allSettled(generationPromises)

          // Process results and collect errors
          const errors: string[] = []
          for (const result of settledResults) {
            if (result.status === "fulfilled") {
              const { type, imageOutputId, data } = result.value
              if (type === "code" && data.success && data.text) {
                results.text = data.text
                results.structuredOutput = data.structuredOutput
              } else if (type === "image" && data.success && data.outputImage?.url && imageOutputId) {
                results.imageUrls.set(imageOutputId, data.outputImage.url)
              }
            } else {
              errors.push(result.reason?.message || "Generation request failed")
            }
          }

          // If all requests failed, throw the first error
          if (errors.length === settledResults.length && errors.length > 0) {
            throw new Error(errors[0])
          }
          // If some requests failed, notify user about partial failure
          if (errors.length > 0) {
            const successCount = settledResults.length - errors.length
            logger.warn('Partial failure: generation requests failed', {
              failedCount: errors.length,
              totalCount: settledResults.length,
              errors,
            })
            toast.warning("Partial generation failure", {
              description: `${successCount} of ${settledResults.length} outputs generated. ${errors.length} failed: ${errors[0]}`,
              duration: 8000,
            })
          }
        } // End of regular generation mode (else block)

        // Check for multi-file output
        const multiFileOutput = results.structuredOutput as MultiFileOutput | undefined
        const hasMultipleFiles = multiFileOutput?.files && multiFileOutput.files.length > 1

        // Prepare auto-generated nodes and edges BEFORE state updates to avoid race conditions
        const newAutoNodes: Node[] = []
        const newAutoEdges: Edge[] = []

        if (hasMultipleFiles && multiFileOutput?.files && codeOutputIds.length > 0) {
          const existingCodeNode = nodesRef.current.find((n) => codeOutputIds.includes(n.id))
          if (existingCodeNode) {
            const basePosition = existingCodeNode.position

            // Create nodes for additional files (skip first, it's already in primary output)
            multiFileOutput.files.slice(1).forEach((file, index) => {
              const newNodeId = `auto-${nodeId}-${Date.now()}-${index}`
              const newNode: Node = {
                id: newNodeId,
                type: "codeNode" as const,
                position: {
                  x: basePosition.x,
                  y: basePosition.y + (index + 1) * 280, // Stack below existing node
                },
                data: {
                  content: file.content,
                  language: file.language,
                  label: file.filename,
                },
              }
              newAutoNodes.push(newNode)

              // Create edge from prompt node to new code node
              const newEdge: Edge = {
                id: `e-auto-${nodeId}-${newNodeId}`,
                source: nodeId,
                target: newNodeId,
                type: "curved" as const,
              }
              newAutoEdges.push(newEdge)
            })
          }
        }

        // Update all output nodes with their respective results
        setNodes((prevNodes) => {
          let updated = prevNodes.map((n) => {
            if (n.id === nodeId) return { ...n, data: { ...n.data, status: "complete" } }

            // Update image outputs with their unique generated images
            if (n.type === "imageNode" && results.imageUrls.has(n.id)) {
              return { ...n, data: { ...n.data, imageUrl: results.imageUrls.get(n.id) } }
            }

            // Update code outputs with primary file
            if (n.type === "codeNode" && codeOutputIds.includes(n.id) && results.text) {
              // If multi-file, update language to match primary file
              const primaryFile = multiFileOutput?.files?.[0]
              return {
                ...n,
                data: {
                  ...n.data,
                  content: results.text,
                  structuredOutput: results.structuredOutput,
                  ...(primaryFile && { language: primaryFile.language, label: primaryFile.filename }),
                },
              }
            }

            return n
          })

          // Add auto-created nodes
          if (newAutoNodes.length > 0) {
            updated = [...updated, ...newAutoNodes]
          }

          return updated
        })

        // Update edges state atomically with auto-created edges
        if (newAutoEdges.length > 0) {
          setEdges((prevEdges) => [...prevEdges, ...newAutoEdges])

          // Notify user about auto-created nodes
          toast.info(`Created ${newAutoNodes.length} additional output${newAutoNodes.length > 1 ? "s" : ""}`, {
            description: multiFileOutput?.files?.slice(1).map((f) => f.filename).join(", "),
          })
        }

        const variationText = imageOutputIds.length > 1 ? ` (${imageOutputIds.length} variations)` : ""
        const multiFileText = hasMultipleFiles ? ` (${multiFileOutput?.files?.length} files)` : ""

        toast.success("Generation complete", {
          description: `Node "${nodesRef.current.find((n) => n.id === nodeId)?.data.title || "Untitled"}" completed${variationText}${multiFileText}`,
        })

        // Clean up timeout and AbortController on successful completion
        clearTimeout(timeoutId)
        abortControllersRef.current.delete(nodeId)

        return {
          imageUrl: results.imageUrls.size > 0 ? results.imageUrls.values().next().value : undefined,
          text: results.text,
        }
      } catch (error) {
        // Always clean up timeout to prevent memory leaks
        clearTimeout(timeoutId)

        // Handle aborted requests gracefully (user cancelled or timeout)
        if (error instanceof Error && error.name === "AbortError") {
          setNodes((prevNodes) =>
            prevNodes.map((n) =>
              n.id === nodeId ? { ...n, data: { ...n.data, status: "idle" } } : n
            )
          )
          // Clean up AbortController on abort
          abortControllersRef.current.delete(nodeId)
          return // Don't show error toast for cancelled requests
        }

        setNodes((prevNodes) =>
          prevNodes.map((n) =>
            n.id === nodeId ? { ...n, data: { ...n.data, status: "error" } } : n
          )
        )

        // Clean up AbortController on error
        abortControllersRef.current.delete(nodeId)

        const errorMessage = error instanceof Error ? error.message : "Generation failed"
        const isRateLimitError = errorMessage.includes("Rate limit")
        const isNetworkError = errorMessage.includes("fetch") || errorMessage.includes("NetworkError")

        toast.error(
          isRateLimitError
            ? "Rate limit exceeded"
            : isNetworkError
              ? "Network error"
              : "Generation failed",
          {
            description: errorMessage,
            duration: isRateLimitError ? 10000 : 5000,
          }
        )

        throw error
      }
    },
    [nodesRef, edgesRef, setNodes, setEdges, userIdRef, workflowId]
  )

  /**
   * Abort execution for a specific node
   */
  const abortNodeExecution = useCallback((nodeId: string) => {
    const controller = abortControllersRef.current.get(nodeId)
    if (controller) {
      controller.abort()
      abortControllersRef.current.delete(nodeId)
    }
  }, [])

  /**
   * Abort all running node executions
   */
  const abortAllExecutions = useCallback(() => {
    abortControllersRef.current.forEach((controller) => {
      controller.abort()
    })
    abortControllersRef.current.clear()
  }, [])

  return {
    handleRunNode,
    abortNodeExecution,
    abortAllExecutions,
    abortControllersRef,
  }
}
