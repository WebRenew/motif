"use client"

import type React from "react"
import type { WorkflowImage } from "@/lib/types/workflow"

import { useState, useCallback, useEffect, useMemo, useRef, useImperativeHandle, forwardRef } from "react"
import {
  ReactFlow,
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
  type NodeTypes,
  type Node,
  type Edge,
  type NodeChange,
  type EdgeChange,
  type Connection,
  type OnConnect,
  ReactFlowProvider,
  useReactFlow,
  BezierEdge,
  type EdgeTypes,
  type Viewport,
} from "@xyflow/react"
import "@xyflow/react/dist/style.css"
import { Plus, Minus, Maximize } from "lucide-react"

import { ImageNode } from "./image-node"
import { PromptNode } from "./prompt-node"
import { CodeNode } from "./code-node"
import { NodeToolbar } from "./node-toolbar"
import { ContextMenu } from "./context-menu"
import { V0Badge } from "@/components/v0-badge"
import { createInitialNodes, initialEdges } from "./workflow-data"
import { getSessionId, createWorkflow, saveNodes, saveEdges } from "@/lib/supabase/workflows"
import { uploadBase64Image } from "@/lib/supabase/storage"
import { getInputImagesFromNodes, getAllInputsFromNodes } from "@/lib/workflow/image-utils"
import { topologicalSort, getPromptDependencies } from "@/lib/workflow/topological-sort"
import { createImageNode, createPromptNode, createCodeNode } from "@/lib/workflow/node-factories"
import { validateWorkflow, validatePromptNodeForExecution } from "@/lib/workflow/validation"
import { validateConnection } from "@/lib/workflow/connection-rules"
import { toast } from "sonner"

export type WorkflowCanvasHandle = {
  runWorkflow: () => Promise<void>
}

type WorkflowCanvasProps = {
  onZoomChange?: (zoom: number) => void
}

const nodeTypes: NodeTypes = {
  imageNode: ImageNode,
  promptNode: PromptNode,
  codeNode: CodeNode,
}

const edgeTypes: EdgeTypes = {
  curved: BezierEdge,
}

const defaultEdgeOptions = {
  type: "curved",
}

const WorkflowCanvasInner = forwardRef<WorkflowCanvasHandle, WorkflowCanvasProps>(({ onZoomChange }, ref) => {
  const [nodes, setNodes] = useState<Node[]>([])
  const [edges, setEdges] = useState<Edge[]>(initialEdges.map((e) => ({ ...e, type: "curved" })))
  const [selectedNodes, setSelectedNodes] = useState<string[]>([])
  const { screenToFlowPosition, setViewport, getViewport, zoomIn, zoomOut, fitView } = useReactFlow()

  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; flowX: number; flowY: number } | null>(null)
  const contextMenuRef = useRef<HTMLDivElement>(null)

  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState<{ x: number; y: number; viewport: Viewport } | null>(null)
  // </CHANGE>

  const initialZoomRef = useRef<number | null>(null)
  const workflowId = useRef<string | null>(null)
  const sessionIdRef = useRef<string>("")
  const [isInitialized, setIsInitialized] = useState(false)

  const nodesRef = useRef<Node[]>([])
  const edgesRef = useRef<Edge[]>(initialEdges.map((e) => ({ ...e, type: "curved" })))
  const isDirtyRef = useRef(false)
  // Track consecutive auto-save failures for user notification
  const consecutiveFailuresRef = useRef(0)
  // Execution lock to prevent workflow state divergence during async execution
  const isExecutingRef = useRef(false)

  // Initialize workflow on mount
  const initWorkflow = useCallback(async () => {
    sessionIdRef.current = getSessionId()

    // Use local images directly - no Supabase blocking
    const initialNodesWithUrls = createInitialNodes(
      "/placeholders/seed-hero.png",
      "/placeholders/integrated-bio.png",
      "/placeholders/combined-output.png",
    )

    setNodes(initialNodesWithUrls)
    nodesRef.current = initialNodesWithUrls
    edgesRef.current = initialEdges.map((e) => ({ ...e, type: "curved" }))
    setIsInitialized(true)

    // Create workflow in background - non-blocking
    createWorkflow(sessionIdRef.current, "My Workflow").then((wfId) => {
      workflowId.current = wfId
    })
  }, [])

  // Auto-save to Supabase
  const saveToSupabase = useCallback(async () => {
    if (!workflowId.current || !isDirtyRef.current || !isInitialized) return

    // Don't auto-save during execution - transient states
    if (isExecutingRef.current) return

    try {
      await saveNodes(workflowId.current, nodesRef.current)
      await saveEdges(workflowId.current, edgesRef.current)
      isDirtyRef.current = false
      // Reset failure counter on successful save
      consecutiveFailuresRef.current = 0
    } catch (error) {
      // Log auto-save failures with context for debugging
      console.error('[Auto-save] Failed to save workflow:', {
        workflowId: workflowId.current,
        nodeCount: nodesRef.current.length,
        edgeCount: edgesRef.current.length,
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString()
      })

      // Track consecutive failures and notify user after 3 failures
      consecutiveFailuresRef.current++
      if (consecutiveFailuresRef.current === 3) {
        toast.warning('Auto-save is having issues', {
          description: 'Your changes may not be saved. Check your connection.',
          duration: 10000
        })
      }
    }
  }, [isInitialized])

  useEffect(() => {
    if (!isInitialized) return

    const saveInterval = setInterval(saveToSupabase, 3000)
    return () => clearInterval(saveInterval)
  }, [saveToSupabase, isInitialized])

  // Node/Edge change handlers
  const onNodesChange = useCallback((changes: NodeChange[]) => {
    // Block mutations during execution, but allow selection changes for UX
    if (isExecutingRef.current) {
      const hasNonSelectChanges = changes.some(c => c.type !== 'select')
      if (hasNonSelectChanges) {
        toast.warning('Cannot modify workflow during execution')
        return
      }
    }

    setNodes((nds) => {
      const updated = applyNodeChanges(changes, nds)
      nodesRef.current = updated
      isDirtyRef.current = true
      return updated
    })

    const selected = changes
      .filter((c): c is NodeChange & { type: "select"; selected: boolean } => c.type === "select" && "selected" in c)
      .filter((c) => c.selected)
      .map((c) => c.id)

    if (selected.length > 0) {
      setSelectedNodes(selected)
    }
  }, [])

  const onEdgesChange = useCallback((changes: EdgeChange[]) => {
    // Block all edge changes during execution
    if (isExecutingRef.current) {
      toast.warning('Cannot modify connections during execution')
      return
    }

    setEdges((eds) => {
      const updated = applyEdgeChanges(changes, eds)
      edgesRef.current = updated
      isDirtyRef.current = true
      return updated
    })
  }, [])

  // Validate connections in real-time for visual feedback
  const isValidConnection = useCallback(
    (connection: Edge | Connection) => {
      const validationResult = validateConnection(connection, nodesRef.current, edgesRef.current)
      return validationResult.valid
    },
    []
  )

  const onConnect: OnConnect = useCallback((connection: Connection) => {
    // Block new connections during execution
    if (isExecutingRef.current) {
      toast.warning('Cannot create connections during execution')
      return
    }

    // Validate the connection before allowing it
    const validationResult = validateConnection(connection, nodesRef.current, edgesRef.current)

    if (!validationResult.valid) {
      // Show error toast
      toast.error(validationResult.error || "Invalid connection", {
        description: validationResult.errorDetails,
        duration: 5000,
      })
      return
    }

    // Connection is valid, add it
    setEdges((eds) => {
      const updated = addEdge({ ...connection, type: "curved" }, eds)
      edgesRef.current = updated
      isDirtyRef.current = true
      return updated
    })
  }, [])

  // Run a single prompt node
  const handleRunNode = useCallback(
    async (nodeId: string, prompt: string, model: string, inputImages?: WorkflowImage[]) => {
      // Validate the node before running
      const validationResult = validatePromptNodeForExecution(nodeId, nodesRef.current, edgesRef.current)

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

      setNodes((prevNodes) => {
        const updated = prevNodes.map((n) => (n.id === nodeId ? { ...n, data: { ...n.data, status: "running" } } : n))
        nodesRef.current = updated
        return updated
      })

      const outputEdges = edgesRef.current.filter((e) => e.source === nodeId)
      const outputNodeIds = outputEdges.map((e) => e.target)

      try {
        const response = await fetch("/api/generate-image", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt,
            model,
            images: imagesToSend,
            textInputs,
            targetLanguage: targetOutput?.language,
          }),
        })

        const data = await response.json()

        // Handle rate limiting specifically
        if (response.status === 429) {
          const resetTime = data.reset ? new Date(data.reset).toLocaleTimeString() : "soon"
          throw new Error(`Rate limit exceeded. Try again at ${resetTime}. ${data.message || ""}`)
        }

        // Handle other HTTP errors
        if (!response.ok) {
          throw new Error(data.error || data.message || `HTTP ${response.status}: Generation failed`)
        }

        if (data.success) {
          let imageUrl = data.outputImage?.url

          if (imageUrl?.startsWith("data:") && workflowId.current) {
            const uploadedUrl = await uploadBase64Image(imageUrl, workflowId.current)
            if (uploadedUrl) imageUrl = uploadedUrl
          }

          setNodes((prevNodes) => {
            const updated = prevNodes.map((n) => {
              if (n.id === nodeId) return { ...n, data: { ...n.data, status: "complete" } }
              if (outputNodeIds.includes(n.id)) {
                if (n.type === "imageNode" && imageUrl) return { ...n, data: { ...n.data, imageUrl } }
                if (n.type === "codeNode" && data.text)
                  return { ...n, data: { ...n.data, content: data.text, structuredOutput: data.structuredOutput } }
              }
              return n
            })
            nodesRef.current = updated
            return updated
          })

          // Show success toast for individual node completion
          toast.success("Generation complete", {
            description: `Node "${nodesRef.current.find((n) => n.id === nodeId)?.data.title || "Untitled"}" completed successfully`,
          })

          return { imageUrl, text: data.text }
        } else {
          throw new Error(data.error || "Generation failed")
        }
      } catch (error) {
        setNodes((prevNodes) => {
          const updated = prevNodes.map((n) => (n.id === nodeId ? { ...n, data: { ...n.data, status: "error" } } : n))
          nodesRef.current = updated
          return updated
        })

        // Show error toast with specific error details
        const errorMessage = error instanceof Error ? error.message : "Generation failed"
        const isRateLimitError = errorMessage.includes("Rate limit")
        const isNetworkError = errorMessage.includes("fetch") || errorMessage.includes("NetworkError")

        toast.error(isRateLimitError ? "Rate limit exceeded" : isNetworkError ? "Network error" : "Generation failed", {
          description: errorMessage,
          duration: isRateLimitError ? 10000 : 5000, // Show rate limit errors longer
        })

        throw error
      }
    },
    [],
  )

  // Run entire workflow
  const runWorkflow = useCallback(async () => {
    if (!isInitialized) return

    // Prevent concurrent workflow execution
    if (isExecutingRef.current) {
      toast.info('Workflow is already running')
      return
    }

    // Set execution lock to prevent state mutations during async execution
    isExecutingRef.current = true

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
    const executionOrder = topologicalSort(promptNodes, getDeps)

    let completedCount = 0
    let failedNode: string | null = null

    for (const promptNode of executionOrder) {
      const inputImages = getInputImagesFromNodes(promptNode.id, currentNodes, currentEdges)

      try {
        const result = await handleRunNode(
          promptNode.id,
          promptNode.data.prompt as string,
          promptNode.data.model as string,
          inputImages,
        )

        if (result?.imageUrl) {
          const outputEdges = currentEdges.filter((e) => e.source === promptNode.id)
          for (const edge of outputEdges) {
            const idx = currentNodes.findIndex((n) => n.id === edge.target)
            if (idx !== -1 && currentNodes[idx].type === "imageNode") {
              currentNodes[idx] = {
                ...currentNodes[idx],
                data: { ...currentNodes[idx].data, imageUrl: result.imageUrl },
              }
            }
          }
        }

        completedCount++
      } catch (error) {
        failedNode = promptNode.data.title as string || "Untitled"
        console.error('[Workflow] Node execution failed:', {
          nodeId: promptNode.id,
          nodeTitle: failedNode,
          error: error instanceof Error ? error.message : String(error),
          completedCount,
          totalNodes: executionOrder.length,
          timestamp: new Date().toISOString()
        })
        break
      }
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
      isExecutingRef.current = false
    }
  }, [isInitialized, handleRunNode])

  useImperativeHandle(ref, () => ({ runWorkflow }), [runWorkflow])

  // Inject handlers into prompt nodes
  const nodesWithHandlers = useMemo(() => {
    return nodes.map((node) => {
      if (node.type === "promptNode") {
        return { ...node, data: { ...node.data, onRun: handleRunNode } }
      }
      return node
    })
  }, [nodes, handleRunNode])

  // Node addition handlers
  const handleAddImageNode = useCallback((position: { x: number; y: number }) => {
    const newNode = createImageNode(position)
    setNodes((nds) => {
      const updated = [...nds, newNode]
      nodesRef.current = updated
      isDirtyRef.current = true
      return updated
    })
    setContextMenu(null)
  }, [])

  const handleAddPromptNode = useCallback((position: { x: number; y: number }, outputType: "image" | "text") => {
    const newNode = createPromptNode(position, outputType)
    setNodes((nds) => {
      const updated = [...nds, newNode]
      nodesRef.current = updated
      isDirtyRef.current = true
      return updated
    })
    setContextMenu(null)
  }, [])

  const handleAddCodeNode = useCallback((position: { x: number; y: number }) => {
    const newNode = createCodeNode(position)
    setNodes((nds) => {
      const updated = [...nds, newNode]
      nodesRef.current = updated
      isDirtyRef.current = true
      return updated
    })
    setContextMenu(null)
  }, [])

  const handleDeleteSelected = useCallback(() => {
    if (selectedNodes.length === 0) return

    setNodes((nds) => {
      const updated = nds.filter((n) => !selectedNodes.includes(n.id))
      nodesRef.current = updated
      isDirtyRef.current = true
      return updated
    })
    setEdges((eds) => {
      const updated = eds.filter((e) => !selectedNodes.includes(e.source) && !selectedNodes.includes(e.target))
      edgesRef.current = updated
      isDirtyRef.current = true
      return updated
    })
    setSelectedNodes([])
  }, [selectedNodes])

  // Context menu handler
  const handlePaneContextMenu = useCallback(
    (event: React.MouseEvent) => {
      event.preventDefault()
      const flowPosition = screenToFlowPosition({ x: event.clientX, y: event.clientY })
      setContextMenu({ x: event.clientX, y: event.clientY, flowX: flowPosition.x, flowY: flowPosition.y })
    },
    [screenToFlowPosition],
  )

  // Click outside to close context menu
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(e.target as HTMLElement)) {
        setContextMenu(null)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  // Delete key handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.key === "Delete" || e.key === "Backspace") && selectedNodes.length > 0) {
        const activeElement = document.activeElement
        if (activeElement?.tagName === "INPUT" || activeElement?.tagName === "TEXTAREA") return
        handleDeleteSelected()
      }
    }
    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [selectedNodes, handleDeleteSelected])

  // Pan handlers
  const handlePaneMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget || (e.target as HTMLElement).classList.contains("react-flow__pane")) {
        setIsDragging(true)
        setDragStart({ x: e.clientX, y: e.clientY, viewport: getViewport() })
      }
    },
    [getViewport],
  )

  const handlePaneMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (isDragging && dragStart) {
        const deltaX = e.clientX - dragStart.x
        const deltaY = (e.clientY - dragStart.y) * 0.3
        setViewport({
          x: dragStart.viewport.x + deltaX,
          y: dragStart.viewport.y + deltaY,
          zoom: dragStart.viewport.zoom,
        })
      }
    },
    [isDragging, dragStart, setViewport],
  )

  const handlePaneMouseUp = useCallback(() => {
    setIsDragging(false)
    setDragStart(null)
  }, [])

  const handleMove = useCallback(
    (_: unknown, viewport: Viewport) => {
      if (initialZoomRef.current === null) initialZoomRef.current = viewport.zoom
      onZoomChange?.(viewport.zoom / (initialZoomRef.current || 1))
    },
    [onZoomChange],
  )

  useEffect(() => {
    initWorkflow()
  }, [initWorkflow])

  function getTargetOutputType(
    promptNodeId: string,
    nodes: Node[],
    edges: Edge[],
  ): { language?: string; label?: string } | null {
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

  return (
    <div
      className="w-full h-full relative"
      onMouseDown={handlePaneMouseDown}
      onMouseMove={handlePaneMouseMove}
      onMouseUp={handlePaneMouseUp}
      style={{ cursor: isDragging ? "grabbing" : "default" }}
    >
      <ReactFlow
        nodes={nodesWithHandlers}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        isValidConnection={isValidConnection}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        defaultEdgeOptions={defaultEdgeOptions}
        nodesDraggable
        nodesConnectable
        elementsSelectable
        selectNodesOnDrag={false}
        panOnScroll={false}
        panOnDrag={false}
        zoomOnScroll
        fitView
        fitViewOptions={{ padding: 0.2 }}
        onMove={handleMove}
        onContextMenu={handlePaneContextMenu}
        className="bg-transparent"
      />

      {contextMenu && (
        <ContextMenu
          ref={contextMenuRef}
          x={contextMenu.x}
          y={contextMenu.y}
          onAddImageNode={() => handleAddImageNode({ x: contextMenu.flowX, y: contextMenu.flowY })}
          onAddImageGenPrompt={() => handleAddPromptNode({ x: contextMenu.flowX, y: contextMenu.flowY }, "image")}
          onAddTextGenPrompt={() => handleAddPromptNode({ x: contextMenu.flowX, y: contextMenu.flowY }, "text")}
          onAddCodeNode={() => handleAddCodeNode({ x: contextMenu.flowX, y: contextMenu.flowY })}
        />
      )}

      <div className="absolute bottom-4 left-4 z-10 flex items-end gap-2">
        <div className="flex flex-col gap-1 bg-card border border-border rounded-lg shadow-sm">
          <button
            onClick={() => zoomIn()}
            className="p-2 hover:bg-muted transition-colors rounded-t-lg"
            aria-label="Zoom in"
          >
            <Plus className="w-4 h-4 text-muted-foreground" />
          </button>
          <button
            onClick={() => zoomOut()}
            className="p-2 hover:bg-muted transition-colors border-t border-border"
            aria-label="Zoom out"
          >
            <Minus className="w-4 h-4 text-muted-foreground" />
          </button>
          <button
            onClick={() => fitView({ padding: 0.2 })}
            className="p-2 hover:bg-muted transition-colors border-t border-border rounded-b-lg"
            aria-label="Fit view"
          >
            <Maximize className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        <div className="ml-2">
          <V0Badge fixed={false} />
        </div>
      </div>

      <NodeToolbar
        onAddImageNode={() => handleAddImageNode({ x: 400, y: 300 })}
        onAddPromptNode={(outputType) => handleAddPromptNode({ x: 400, y: 300 }, outputType)}
        onAddCodeNode={() => handleAddCodeNode({ x: 400, y: 300 })}
        onDeleteSelected={handleDeleteSelected}
        hasSelection={selectedNodes.length > 0}
      />
    </div>
  )
})

WorkflowCanvasInner.displayName = "WorkflowCanvasInner"

export const WorkflowCanvas = forwardRef<WorkflowCanvasHandle, WorkflowCanvasProps>((props, ref) => {
  return (
    <ReactFlowProvider>
      <WorkflowCanvasInner {...props} ref={ref} />
    </ReactFlowProvider>
  )
})

WorkflowCanvas.displayName = "WorkflowCanvas"
