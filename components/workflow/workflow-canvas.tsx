"use client"

import type React from "react"
import type { WorkflowImage } from "@/lib/types/workflow"
import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime"

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
import { SaveTemplateModal } from "./save-template-modal"
import { DeleteConfirmationDialog } from "./delete-confirmation-dialog"
import { V0Badge } from "@/components/v0-badge"
import { createInitialNodes, initialEdges } from "./workflow-data"
import { initializeUser, createWorkflow, saveNodes, saveEdges, getUserWorkflows, loadWorkflow, saveAsTemplate } from "@/lib/supabase/workflows"
import { getSeedImageUrls } from "@/lib/supabase/storage"
import { getInputImagesFromNodes, getAllInputsFromNodes } from "@/lib/workflow/image-utils"
import { topologicalSort, getPromptDependencies, CycleDetectedError } from "@/lib/workflow/topological-sort"
import { createImageNode, createPromptNode, createCodeNode } from "@/lib/workflow/node-factories"
import { validateWorkflow, validatePromptNodeForExecution } from "@/lib/workflow/validation"
import { validateConnection } from "@/lib/workflow/connection-rules"
import { toast } from "sonner"

export type WorkflowCanvasHandle = {
  runWorkflow: () => Promise<void>
  openSaveModal: () => void
  loadTemplate: (templateId: string) => Promise<void>
}

type WorkflowCanvasProps = {
  workflowId?: string
  router?: AppRouterInstance
  onZoomChange?: (zoom: number) => void
  hideControls?: boolean
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

const WorkflowCanvasInner = forwardRef<WorkflowCanvasHandle, WorkflowCanvasProps>(({ workflowId: propWorkflowId, router, onZoomChange, hideControls }, ref) => {
  const [nodes, setNodes] = useState<Node[]>([])
  const [edges, setEdges] = useState<Edge[]>(initialEdges.map((e) => ({ ...e, type: "curved" })))
  const [selectedNodes, setSelectedNodes] = useState<string[]>([])
  const { screenToFlowPosition, setViewport, getViewport, zoomIn, zoomOut, fitView } = useReactFlow()

  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; flowX: number; flowY: number } | null>(null)
  const contextMenuRef = useRef<HTMLDivElement>(null)

  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState<{ x: number; y: number; viewport: Viewport } | null>(null)

  const [showSaveModal, setShowSaveModal] = useState(false)
  const [isSavingTemplate, setIsSavingTemplate] = useState(false)
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false)
  // </CHANGE>

  const initialZoomRef = useRef<number | null>(null)
  const workflowId = useRef<string | null>(null)
  const userIdRef = useRef<string | null>(null)
  const [isInitialized, setIsInitialized] = useState(false)

  const nodesRef = useRef<Node[]>([])
  const edgesRef = useRef<Edge[]>(initialEdges.map((e) => ({ ...e, type: "curved" })))
  // Track consecutive auto-save failures for user notification
  const consecutiveFailuresRef = useRef(0)
  // Execution lock to prevent workflow state divergence during async execution
  const isExecutingRef = useRef(false)
  // Save lock to prevent concurrent auto-save operations
  const isSavingRef = useRef(false)
  // Debounce timer for auto-save
  const saveDebounceRef = useRef<NodeJS.Timeout | null>(null)

  // History tracking for undo/redo
  const historyRef = useRef<Array<{ nodes: Node[]; edges: Edge[] }>>([])
  const historyIndexRef = useRef(-1)
  const MAX_HISTORY_SIZE = 50

  // Initialize workflow on mount - authenticate user, then load specific workflow or create new
  const initWorkflow = useCallback(async () => {
    // First, authenticate the user (creates anonymous user if needed)
    const userId = await initializeUser()

    if (!userId) {
      console.error("[Workflow] Failed to initialize user - workflow will not be saved")
      toast.warning("Could not authenticate", {
        description: "Your work will not be saved. Check your connection and refresh to retry.",
        duration: 10000,
      })

      // Still show the UI with default workflow, just won't save
      const { seedHeroUrl, integratedBioUrl, combinedOutputUrl } = getSeedImageUrls()
      const initialNodesWithUrls = createInitialNodes(seedHeroUrl, integratedBioUrl, combinedOutputUrl)
      setNodes(initialNodesWithUrls)
      nodesRef.current = initialNodesWithUrls
      edgesRef.current = initialEdges.map((e) => ({ ...e, type: "curved" }))
      setIsInitialized(true)
      historyRef.current = [{ nodes: initialNodesWithUrls, edges: initialEdges.map((e) => ({ ...e, type: "curved" })) }]
      historyIndexRef.current = 0
      return
    }

    userIdRef.current = userId

    // If a specific workflow ID was provided, load that workflow
    if (propWorkflowId) {
      try {
        const workflowData = await loadWorkflow(propWorkflowId)

        if (workflowData) {
          // Check if workflow has nodes
          if (workflowData.nodes.length > 0) {
            // Restore the specific workflow with existing nodes
            const restoredNodes = workflowData.nodes
            const restoredEdges = workflowData.edges.map((e) => ({ ...e, type: "curved" as const }))

            setNodes(restoredNodes)
            setEdges(restoredEdges)
            nodesRef.current = restoredNodes
            edgesRef.current = restoredEdges
            workflowId.current = workflowData.id
            setIsInitialized(true)

            // Initialize history with restored state
            historyRef.current = [{ nodes: restoredNodes, edges: restoredEdges }]
            historyIndexRef.current = 0

            console.log("[Workflow] Loaded workflow by ID:", {
              workflowId: workflowData.id,
              userId,
              nodeCount: restoredNodes.length,
              edgeCount: restoredEdges.length,
            })
            return
          } else {
            // Workflow exists but is empty - initialize with default nodes
            console.log("[Workflow] Empty workflow found, initializing with defaults:", propWorkflowId)

            const { seedHeroUrl, integratedBioUrl, combinedOutputUrl } = getSeedImageUrls()
            const initialNodesWithUrls = createInitialNodes(seedHeroUrl, integratedBioUrl, combinedOutputUrl)

            setNodes(initialNodesWithUrls)
            setEdges(initialEdges.map((e) => ({ ...e, type: "curved" })))
            nodesRef.current = initialNodesWithUrls
            edgesRef.current = initialEdges.map((e) => ({ ...e, type: "curved" }))
            workflowId.current = propWorkflowId
            setIsInitialized(true)

            // Initialize history
            historyRef.current = [{ nodes: initialNodesWithUrls, edges: initialEdges.map((e) => ({ ...e, type: "curved" })) }]
            historyIndexRef.current = 0

            // Save initial nodes to the workflow
            await saveNodes(propWorkflowId, initialNodesWithUrls)
            await saveEdges(propWorkflowId, initialEdges.map((e) => ({ ...e, type: "curved" })))

            console.log("[Workflow] Initialized empty workflow with defaults")
            return
          }
        } else {
          console.error("[Workflow] Workflow not found:", propWorkflowId)
          toast.error("Workflow not found", {
            description: "This workflow doesn't exist or you don't have access to it.",
          })
        }
      } catch (error) {
        console.error("[Workflow] Failed to load workflow by ID:", {
          workflowId: propWorkflowId,
          error: error instanceof Error ? error.message : String(error),
          userId,
          timestamp: new Date().toISOString(),
        })
        toast.error("Failed to load workflow", {
          description: "Could not load this workflow. It may not exist or you may not have access.",
        })
      }
    }

    // If no workflow ID provided, try to load most recent workflow
    if (!propWorkflowId) {
      try {
        // Try to load existing workflow for this user
        const existingWorkflows = await getUserWorkflows(userId)

        if (existingWorkflows.length > 0) {
          // Load the most recent workflow
          const mostRecent = existingWorkflows[0]
          const workflowData = await loadWorkflow(mostRecent.id)

          if (workflowData && workflowData.nodes.length > 0) {
            // Restore existing workflow
            const restoredNodes = workflowData.nodes
            const restoredEdges = workflowData.edges.map((e) => ({ ...e, type: "curved" as const }))

            setNodes(restoredNodes)
            setEdges(restoredEdges)
            nodesRef.current = restoredNodes
            edgesRef.current = restoredEdges
            workflowId.current = workflowData.id
            setIsInitialized(true)

            // Initialize history with restored state
            historyRef.current = [{ nodes: restoredNodes, edges: restoredEdges }]
            historyIndexRef.current = 0

            console.log("[Workflow] Restored most recent workflow:", {
              workflowId: workflowData.id,
              userId,
              nodeCount: restoredNodes.length,
              edgeCount: restoredEdges.length,
            })
            return
          }
        }
      } catch (error) {
        console.error("[Workflow] Failed to load existing workflow, creating new:", {
          error: error instanceof Error ? error.message : String(error),
          userId,
          timestamp: new Date().toISOString(),
        })
      }
    }

    // No existing workflow found or failed to load - create new with defaults
    const { seedHeroUrl, integratedBioUrl, combinedOutputUrl } = getSeedImageUrls()

    const initialNodesWithUrls = createInitialNodes(
      seedHeroUrl,
      integratedBioUrl,
      combinedOutputUrl,
    )

    setNodes(initialNodesWithUrls)
    nodesRef.current = initialNodesWithUrls
    edgesRef.current = initialEdges.map((e) => ({ ...e, type: "curved" }))
    setIsInitialized(true)

    // Initialize history with first state
    historyRef.current = [{ nodes: initialNodesWithUrls, edges: initialEdges.map((e) => ({ ...e, type: "curved" })) }]
    historyIndexRef.current = 0

    // Create workflow in background - non-blocking
    createWorkflow(userId, "My Workflow")
      .then((wfId) => {
        if (wfId) {
          workflowId.current = wfId
          console.log("[Workflow] Created new workflow:", { workflowId: wfId, userId })
        } else {
          console.error("[Workflow] createWorkflow returned null - workflow will not be saved")
          toast.warning("Could not connect to cloud storage", {
            description: "Your work will not be saved. Check your connection and refresh to retry.",
            duration: 10000,
          })
        }
      })
      .catch((error) => {
        console.error("[Workflow] Failed to create workflow:", {
          error: error instanceof Error ? error.message : String(error),
          userId,
          timestamp: new Date().toISOString(),
        })
        toast.warning("Could not connect to cloud storage", {
          description: "Your work will not be saved. Check your connection and refresh to retry.",
          duration: 10000,
        })
      })
  }, [propWorkflowId])

  // Push current state to history
  const pushToHistory = useCallback(() => {
    // Don't record history during execution
    if (isExecutingRef.current) return

    const currentState = { nodes: [...nodesRef.current], edges: [...edgesRef.current] }

    // Remove any future history if we're not at the end
    if (historyIndexRef.current < historyRef.current.length - 1) {
      historyRef.current = historyRef.current.slice(0, historyIndexRef.current + 1)
    }

    // Add new state
    historyRef.current.push(currentState)
    historyIndexRef.current++

    // Limit history size
    if (historyRef.current.length > MAX_HISTORY_SIZE) {
      historyRef.current.shift()
      historyIndexRef.current--
    }
  }, [])

  // Undo - restore previous state (debouncedSave called after definition below)
  const undoImpl = useCallback(() => {
    if (historyIndexRef.current <= 0) {
      toast.info('Nothing to undo')
      return false
    }

    historyIndexRef.current--
    const previousState = historyRef.current[historyIndexRef.current]

    setNodes(previousState.nodes)
    setEdges(previousState.edges)
    nodesRef.current = previousState.nodes
    edgesRef.current = previousState.edges

    toast.success('Undo')
    return true
  }, [])

  // Redo - restore next state (debouncedSave called after definition below)
  const redoImpl = useCallback(() => {
    if (historyIndexRef.current >= historyRef.current.length - 1) {
      toast.info('Nothing to redo')
      return false
    }

    historyIndexRef.current++
    const nextState = historyRef.current[historyIndexRef.current]

    setNodes(nextState.nodes)
    setEdges(nextState.edges)
    nodesRef.current = nextState.nodes
    edgesRef.current = nextState.edges

    toast.success('Redo')
    return true
  }, [])

  // Auto-save to Supabase (called by debouncedSave)
  const saveToSupabase = useCallback(async () => {
    if (!workflowId.current || !isInitialized) return

    // Don't auto-save during execution - transient states
    if (isExecutingRef.current) return

    // Prevent concurrent saves to avoid race conditions
    if (isSavingRef.current) return

    isSavingRef.current = true
    try {
      await saveNodes(workflowId.current, nodesRef.current)
      await saveEdges(workflowId.current, edgesRef.current)
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

      // Track consecutive failures and notify user periodically
      consecutiveFailuresRef.current++
      // Warn at 3 failures, then every 10 failures to remind user of ongoing issue
      if (consecutiveFailuresRef.current === 3 || consecutiveFailuresRef.current % 10 === 0) {
        toast.warning('Auto-save is having issues', {
          description: 'Your changes may not be saved. Check your connection.',
          duration: 10000
        })
      }
    } finally {
      // Always release save lock
      isSavingRef.current = false
    }
  }, [isInitialized])

  // Debounced save - waits 1.5s after last change before saving
  const debouncedSave = useCallback(() => {
    if (saveDebounceRef.current) {
      clearTimeout(saveDebounceRef.current)
    }
    saveDebounceRef.current = setTimeout(() => {
      saveToSupabase()
    }, 1500)
  }, [saveToSupabase])

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (saveDebounceRef.current) {
        clearTimeout(saveDebounceRef.current)
      }
    }
  }, [])

  // Undo/Redo wrappers that trigger save
  const undo = useCallback(() => {
    if (undoImpl()) {
      debouncedSave()
    }
  }, [undoImpl, debouncedSave])

  const redo = useCallback(() => {
    if (redoImpl()) {
      debouncedSave()
    }
  }, [redoImpl, debouncedSave])

  // Node/Edge change handlers
  const onNodesChange = useCallback((changes: NodeChange[]) => {
    const hasNonSelectChanges = changes.some(c => c.type !== 'select')

    // Block mutations during execution, but allow selection changes for UX
    if (isExecutingRef.current) {
      if (hasNonSelectChanges) {
        toast.warning('Cannot modify workflow during execution')
        return
      }
    }

    setNodes((nds) => {
      const updated = applyNodeChanges(changes, nds)
      nodesRef.current = updated
      return updated
    })

    // Push to history and trigger save for non-selection changes
    if (hasNonSelectChanges) {
      pushToHistory()
      debouncedSave()
    }

    const selected = changes
      .filter((c): c is NodeChange & { type: "select"; selected: boolean } => c.type === "select" && "selected" in c)
      .filter((c) => c.selected)
      .map((c) => c.id)

    if (selected.length > 0) {
      setSelectedNodes(selected)
    }
  }, [pushToHistory, debouncedSave])

  const onEdgesChange = useCallback((changes: EdgeChange[]) => {
    // Block all edge changes during execution
    if (isExecutingRef.current) {
      toast.warning('Cannot modify connections during execution')
      return
    }

    setEdges((eds) => {
      const updated = applyEdgeChanges(changes, eds)
      edgesRef.current = updated
      return updated
    })

    // Push to history and trigger save after edge changes
    pushToHistory()
    debouncedSave()
  }, [pushToHistory, debouncedSave])

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
      return updated
    })

    // Push to history and trigger save after adding connection
    pushToHistory()
    debouncedSave()
  }, [pushToHistory, debouncedSave])

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

      // Check if node exists before setting status (node could have been deleted between validation and execution)
      setNodes((prevNodes) => {
        const nodeExists = prevNodes.some(n => n.id === nodeId)
        if (!nodeExists) {
          console.warn(`[Workflow] Cannot run deleted node: ${nodeId}`)
          return prevNodes  // No changes
        }

        const updated = prevNodes.map((n) => (n.id === nodeId ? { ...n, data: { ...n.data, status: "running" } } : n))
        nodesRef.current = updated
        return updated
      })

      // Verify node still exists after state update (defensive check)
      if (!nodesRef.current.some(n => n.id === nodeId)) {
        toast.warning('Node was deleted during execution')
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

      try {
        const results: { imageUrls: Map<string, string>; text?: string; structuredOutput?: object } = {
          imageUrls: new Map(),
        }

        // Generate code output (one call)
        if (codeOutputIds.length > 0) {
          const response = await fetch("/api/generate-image", {
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
          })

          const data = await response.json()

          if (response.status === 429) {
            const resetTime = data.reset ? new Date(data.reset).toLocaleTimeString() : "soon"
            throw new Error(`${data.message || "Rate limit exceeded."} Please try again at ${resetTime}.`)
          }
          if (!response.ok) {
            throw new Error(data.error || data.message || `HTTP ${response.status}: Generation failed`)
          }
          if (data.success && data.text) {
            results.text = data.text
            results.structuredOutput = data.structuredOutput
          }
        }

        // Generate image outputs (separate call per image for variations)
        for (const imageOutputId of imageOutputIds) {
          const response = await fetch("/api/generate-image", {
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
          })

          const data = await response.json()

          if (response.status === 429) {
            const resetTime = data.reset ? new Date(data.reset).toLocaleTimeString() : "soon"
            throw new Error(`${data.message || "Rate limit exceeded."} Please try again at ${resetTime}.`)
          }
          if (!response.ok) {
            throw new Error(data.error || data.message || `HTTP ${response.status}: Generation failed`)
          }
          if (data.success && data.outputImage?.url) {
            results.imageUrls.set(imageOutputId, data.outputImage.url)
          }
        }

        // Check for multi-file output
        const multiFileOutput = results.structuredOutput as { files?: Array<{ filename: string; language: string; content: string }> } | undefined
        const hasMultipleFiles = multiFileOutput?.files && multiFileOutput.files.length > 1

        // Prepare auto-generated nodes and edges BEFORE state updates to avoid race conditions
        const newAutoNodes: Node[] = []
        const newAutoEdges: Edge[] = []

        if (hasMultipleFiles && multiFileOutput?.files && codeOutputIds.length > 0) {
          const existingCodeNode = nodesRef.current.find(n => codeOutputIds.includes(n.id))
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
                  y: basePosition.y + (index + 1) * 280 // Stack below existing node
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
                  ...(primaryFile && { language: primaryFile.language, label: primaryFile.filename })
                } 
              }
            }
            
            return n
          })

          // Add auto-created nodes
          if (newAutoNodes.length > 0) {
            updated = [...updated, ...newAutoNodes]
          }

          nodesRef.current = updated
          return updated
        })

        // Update edges state atomically with auto-created edges
        if (newAutoEdges.length > 0) {
          setEdges((prevEdges) => {
            const updated = [...prevEdges, ...newAutoEdges]
            edgesRef.current = updated
            return updated
          })

          // Notify user about auto-created nodes
          toast.info(`Created ${newAutoNodes.length} additional output${newAutoNodes.length > 1 ? 's' : ''}`, {
            description: multiFileOutput?.files?.slice(1).map(f => f.filename).join(', '),
          })
        }

        const _totalOutputs = imageOutputIds.length + codeOutputIds.length
        const variationText = imageOutputIds.length > 1 ? ` (${imageOutputIds.length} variations)` : ""
        const multiFileText = hasMultipleFiles ? ` (${multiFileOutput?.files?.length} files)` : ""
        
        toast.success("Generation complete", {
          description: `Node "${nodesRef.current.find((n) => n.id === nodeId)?.data.title || "Untitled"}" completed${variationText}${multiFileText}`,
        })

        return { 
          imageUrl: results.imageUrls.size > 0 ? results.imageUrls.values().next().value : undefined, 
          text: results.text 
        }
      } catch (error) {
        setNodes((prevNodes) => {
          const updated = prevNodes.map((n) => (n.id === nodeId ? { ...n, data: { ...n.data, status: "error" } } : n))
          nodesRef.current = updated
          return updated
        })

        const errorMessage = error instanceof Error ? error.message : "Generation failed"
        const isRateLimitError = errorMessage.includes("Rate limit")
        const isNetworkError = errorMessage.includes("fetch") || errorMessage.includes("NetworkError")

        toast.error(isRateLimitError ? "Rate limit exceeded" : isNetworkError ? "Network error" : "Generation failed", {
          description: errorMessage,
          duration: isRateLimitError ? 10000 : 5000,
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
    
    // Compute execution order with cycle detection
    let executionOrder: Node[]
    try {
      executionOrder = topologicalSort(promptNodes, getDeps)
    } catch (error) {
      if (error instanceof CycleDetectedError) {
        // Find node titles for user-friendly message
        const cycleNodeTitles = error.cycleNodeIds.map(id => {
          const node = currentNodes.find(n => n.id === id)
          return (node?.data?.title as string) || id
        })
        toast.error("Circular dependency detected", {
          description: `Workflow cannot execute: ${cycleNodeTitles.join(" → ")}`,
          duration: 8000,
        })
        console.error('[Workflow] Cycle detected:', {
          cycleNodeIds: error.cycleNodeIds,
          cycleNodeTitles,
          timestamp: new Date().toISOString()
        })
        return
      }
      throw error  // Re-throw unexpected errors
    }

    let completedCount = 0
    let failedNode: string | null = null

    for (const promptNode of executionOrder) {
      // Use live refs instead of stale snapshot to get freshly generated upstream outputs
      const inputImages = getInputImagesFromNodes(promptNode.id, nodesRef.current, edgesRef.current)

      try {
        await handleRunNode(
          promptNode.id,
          promptNode.data.prompt as string,
          promptNode.data.model as string,
          inputImages,
        )

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

  const openSaveModal = useCallback(() => {
    if (!userIdRef.current) {
      toast.error("Not authenticated", {
        description: "Please sign in to save templates.",
      })
      return
    }
    setShowSaveModal(true)
  }, [])

  const handleSaveTemplate = useCallback(
    async (data: { name: string; icon: string; tags: string[]; description?: string }) => {
      if (!userIdRef.current) {
        toast.error("Not authenticated", {
          description: "Please sign in to save templates.",
        })
        return
      }

      setIsSavingTemplate(true)

      try {
        const templateId = await saveAsTemplate(
          userIdRef.current,
          data.name,
          nodesRef.current,
          edgesRef.current,
          data.icon,
          data.tags,
          data.description,
        )

        if (templateId) {
          toast.success("Template saved", {
            description: `"${data.name}" is now available in My Workflows.`,
          })
          setShowSaveModal(false)
        } else {
          toast.error("Failed to save template", {
            description: "Please try again.",
          })
        }
      } catch (error) {
        console.error("[WorkflowCanvas] Error saving template:", error)
        toast.error("Failed to save template", {
          description: "An unexpected error occurred.",
        })
      } finally {
        setIsSavingTemplate(false)
      }
    },
    [],
  )

  const loadTemplate = useCallback(async (templateId: string) => {
    if (!userIdRef.current) {
      toast.error("Not authenticated", {
        description: "Please sign in to fork templates.",
      })
      return
    }

    if (!router) {
      toast.error("Navigation unavailable", {
        description: "Cannot navigate to new workflow.",
      })
      return
    }

    try {
      // Load the template data
      const templateData = await loadWorkflow(templateId)

      if (!templateData) {
        toast.error("Failed to load template", {
          description: "The template could not be found.",
        })
        return
      }

      // Create a new workflow with the template data
      const newWorkflowId = await createWorkflow(userIdRef.current, templateData.name)

      if (!newWorkflowId) {
        toast.error("Failed to create workflow", {
          description: "Could not fork template.",
        })
        return
      }

      // Save the template nodes/edges to the new workflow
      const templateNodes = templateData.nodes
      const templateEdges = templateData.edges

      await saveNodes(newWorkflowId, templateNodes)
      await saveEdges(newWorkflowId, templateEdges)

      toast.success("Template forked", {
        description: `Created new workflow from "${templateData.name}".`,
      })

      // Navigate to the new workflow
      router.push(`/w/${newWorkflowId}`)
    } catch (error) {
      console.error("[WorkflowCanvas] Error forking template:", error)
      toast.error("Failed to fork template", {
        description: "An unexpected error occurred.",
      })
    }
  }, [router])

  useImperativeHandle(ref, () => ({ runWorkflow, openSaveModal, loadTemplate }), [runWorkflow, openSaveModal, loadTemplate])

  // Handler for code node language changes
  const handleLanguageChange = useCallback((nodeId: string, language: string) => {
    setNodes((nds) => {
      const updated = nds.map((n) =>
        n.id === nodeId ? { ...n, data: { ...n.data, language } } : n
      )
      nodesRef.current = updated
      return updated
    })
    debouncedSave()
  }, [debouncedSave])

  // Inject handlers into prompt nodes and code nodes, and calculate sequence numbers for image nodes
  const nodesWithHandlers = useMemo(() => {
    try {
      // Calculate sequence numbers for imageNodes based on Y position
      // Only include image nodes that are connected (have outgoing edges)
      const connectedImageNodeIds = new Set(
        edges.filter(e => {
          const sourceNode = nodes.find(n => n.id === e.source)
          return sourceNode?.type === "imageNode"
        }).map(e => e.source)
      )

      const imageNodes = nodes.filter(n => n.type === "imageNode" && connectedImageNodeIds.has(n.id))

      // Filter out nodes without valid positions before sorting
      const imageNodesWithValidPosition = imageNodes.filter(
        n => n.position && typeof n.position.y === "number" && Number.isFinite(n.position.y)
      )

      // Sort by Y position (top to bottom) - safe to access position.y after filter
      const sortedImageNodes = [...imageNodesWithValidPosition].sort((a, b) => {
        return a.position.y - b.position.y
      })

      const sequenceMap = new Map<string, number>()

      // Only assign sequence numbers if there are 2 or more connected image nodes with valid positions
      if (sortedImageNodes.length >= 2) {
        sortedImageNodes.forEach((node, index) => {
          sequenceMap.set(node.id, index + 1)
        })
      }

      return nodes.map((node) => {
        if (node.type === "promptNode") {
          return { ...node, data: { ...node.data, onRun: handleRunNode } }
        }
        if (node.type === "codeNode") {
          return {
            ...node,
            data: {
              ...node.data,
              onLanguageChange: handleLanguageChange
            }
          }
        }
        if (node.type === "imageNode" && sequenceMap.has(node.id)) {
          return {
            ...node,
            data: {
              ...node.data,
              sequenceNumber: sequenceMap.get(node.id)
            }
          }
        }
        return node
      })
    } catch (error) {
      console.error('[WorkflowCanvas] Error calculating sequence numbers:', {
        error: error instanceof Error ? error.message : String(error),
        nodeCount: nodes.length,
        timestamp: new Date().toISOString()
      })

      // Return nodes without sequence numbers as fallback
      return nodes.map((node) => {
        if (node.type === "promptNode") {
          return { ...node, data: { ...node.data, onRun: handleRunNode } }
        }
        if (node.type === "codeNode") {
          return {
            ...node,
            data: {
              ...node.data,
              onLanguageChange: handleLanguageChange
            }
          }
        }
        return node
      })
    }
  }, [nodes, edges, handleRunNode, handleLanguageChange])

  // Node addition handlers
  const handleAddImageNode = useCallback((position: { x: number; y: number }) => {
    const newNode = createImageNode(position)
    setNodes((nds) => {
      const updated = [...nds, newNode]
      nodesRef.current = updated
      return updated
    })
    pushToHistory()
    debouncedSave()
    setContextMenu(null)
  }, [pushToHistory, debouncedSave])

  const handleAddPromptNode = useCallback((position: { x: number; y: number }, outputType: "image" | "text") => {
    const newNode = createPromptNode(position, outputType)
    setNodes((nds) => {
      const updated = [...nds, newNode]
      nodesRef.current = updated
      return updated
    })
    pushToHistory()
    debouncedSave()
    setContextMenu(null)
  }, [pushToHistory, debouncedSave])

  const handleAddCodeNode = useCallback((position: { x: number; y: number }) => {
    const newNode = createCodeNode(position)
    setNodes((nds) => {
      const updated = [...nds, newNode]
      nodesRef.current = updated
      return updated
    })
    pushToHistory()
    debouncedSave()
    setContextMenu(null)
  }, [pushToHistory, debouncedSave])

  const handleDeleteSelected = useCallback(() => {
    if (selectedNodes.length === 0) return

    // Show confirmation dialog
    setShowDeleteConfirmation(true)
  }, [selectedNodes])

  const confirmDelete = useCallback(async () => {
    if (selectedNodes.length === 0) return

    setNodes((nds) => {
      const updated = nds.filter((n) => !selectedNodes.includes(n.id))
      nodesRef.current = updated
      return updated
    })
    setEdges((eds) => {
      const updated = eds.filter((e) => !selectedNodes.includes(e.source) && !selectedNodes.includes(e.target))
      edgesRef.current = updated
      return updated
    })
    pushToHistory()

    // Cancel any pending debounced saves
    if (saveDebounceRef.current) {
      clearTimeout(saveDebounceRef.current)
    }

    // Wait for any in-flight saves to complete, then force immediate save
    const maxWaitTime = 5000 // 5 seconds max wait
    const startTime = Date.now()
    while (isSavingRef.current && Date.now() - startTime < maxWaitTime) {
      await new Promise(resolve => setTimeout(resolve, 50))
    }

    // Force immediate save for destructive actions
    console.log('[Delete] Attempting to save deletion:', {
      workflowId: workflowId.current,
      isInitialized,
      nodeCount: nodesRef.current.length,
      edgeCount: edgesRef.current.length,
    })

    if (workflowId.current && isInitialized) {
      isSavingRef.current = true
      try {
        console.log('[Delete] Saving nodes...')
        await saveNodes(workflowId.current, nodesRef.current)
        console.log('[Delete] Nodes saved successfully')

        console.log('[Delete] Saving edges...')
        await saveEdges(workflowId.current, edgesRef.current)
        console.log('[Delete] Edges saved successfully')

        consecutiveFailuresRef.current = 0
      } catch (error) {
        console.error('[Delete] Failed to save after deletion:', error)
        toast.error('Failed to save deletion', {
          description: 'Your changes may not be persisted. Please try again.',
        })
      } finally {
        isSavingRef.current = false
      }
    } else {
      console.warn('[Delete] Cannot save - missing workflowId or not initialized', {
        workflowId: workflowId.current,
        isInitialized,
      })
      toast.warning('Cannot save deletion', {
        description: 'Workflow not initialized. Changes may not persist.',
      })
    }

    setSelectedNodes([])
    setShowDeleteConfirmation(false)

    toast.success("Deleted", {
      description: `Removed ${selectedNodes.length} ${selectedNodes.length === 1 ? "node" : "nodes"}`,
    })
  }, [selectedNodes, pushToHistory, isInitialized])

  // Context menu handler
  const handlePaneContextMenu = useCallback(
    (event: React.MouseEvent) => {
      const target = event.target as HTMLElement
      
      // Allow native browser context menu for editable elements (spell check, autocorrect, etc.)
      const isEditableElement = 
        target.tagName === "TEXTAREA" ||
        target.tagName === "INPUT" ||
        target.isContentEditable ||
        target.closest("[contenteditable='true']") !== null
      
      if (isEditableElement) {
        // Don't prevent default - allow browser's native context menu
        return
      }
      
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

  // Undo/Redo keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in input/textarea
      const activeElement = document.activeElement
      if (activeElement?.tagName === "INPUT" || activeElement?.tagName === "TEXTAREA") return

      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0
      const modifier = isMac ? e.metaKey : e.ctrlKey

      // Cmd/Ctrl + Z for undo
      if (modifier && e.key === 'z' && !e.shiftKey) {
        e.preventDefault()
        undo()
      }

      // Cmd/Ctrl + Shift + Z or Ctrl + Y for redo
      if ((modifier && e.shiftKey && e.key === 'z') || (e.ctrlKey && e.key === 'y')) {
        e.preventDefault()
        redo()
      }
    }

    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [undo, redo])

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
        selectionOnDrag
        panOnScroll
        panOnDrag={[1, 2]}
        zoomOnScroll
        zoomOnPinch
        fitView
        fitViewOptions={{ padding: 0.2 }}
        onMove={handleMove}
        onContextMenu={handlePaneContextMenu}
        className="bg-transparent touch-pan-x touch-pan-y"
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
          onSaveWorkflow={() => {
            setContextMenu(null)
            openSaveModal()
          }}
        />
      )}

      {!hideControls && (
        <>
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
        </>
      )}

      {/* Save Template Modal */}
      <SaveTemplateModal
        isOpen={showSaveModal}
        onClose={() => setShowSaveModal(false)}
        onSave={handleSaveTemplate}
        isSaving={isSavingTemplate}
      />

      {/* Delete Confirmation Dialog */}
      <DeleteConfirmationDialog
        isOpen={showDeleteConfirmation}
        nodeCount={selectedNodes.length}
        onConfirm={confirmDelete}
        onCancel={() => setShowDeleteConfirmation(false)}
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
