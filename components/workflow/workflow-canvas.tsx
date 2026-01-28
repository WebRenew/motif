"use client"

import type React from "react"
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

import { ImageNode, type ImageNodeData } from "./image-node"
import { PromptNode } from "./prompt-node"
import { CodeNode } from "./code-node"
import { TextInputNode } from "./text-input-node"
import { StickyNoteNode } from "./sticky-note-node"
import { CaptureNode } from "./capture-node"
import { NodeToolbar } from "./node-toolbar"
import { VisualControls } from "./visual-controls"
import { ContextMenu } from "./context-menu"
import { SaveTemplateModal } from "./save-template-modal"
import { DeleteConfirmationDialog } from "./delete-confirmation-dialog"
import { V0Badge } from "@/components/v0-badge"
import { AgentChat } from "@/components/agent/agent-chat"
import { createInitialNodes, initialEdges } from "./workflow-data"
import { initializeUser, createWorkflow, saveNodes, saveEdges, getUserWorkflows, loadWorkflow, saveAsTemplate, renameWorkflow, generateWorkflowName } from "@/lib/supabase/workflows"
import { getSeedImageUrls } from "@/lib/supabase/storage"
import { TOOL_WORKFLOW_CONFIG, type ToolWorkflowType } from "@/lib/workflow/tool-workflows"

import { validateConnection } from "@/lib/workflow/connection-rules"

import { useSyncedState, useSyncedRef } from "@/lib/hooks/use-synced-state"
import { useWorkflowHistory } from "@/lib/hooks/use-workflow-history"
import { useCaptureNode } from "@/lib/hooks/use-capture-node"
import { useNodeOperations } from "@/lib/hooks/use-node-operations"
import { useNodeExecution } from "@/lib/hooks/use-node-execution"
import { useWorkflowExecution } from "@/lib/hooks/use-workflow-execution"
import { useAgentBridge } from "@/lib/hooks/use-agent-bridge"
import { useAuth } from "@/lib/context/auth-context"
import { toast } from "sonner"
import { createLogger } from "@/lib/logger"
import { SAVE_FAILURE_WARN_THRESHOLD, SAVE_FAILURE_REMINDER_INTERVAL } from "@/lib/constants"

const logger = createLogger('workflow-canvas')

// Sanitize capture nodes when loading workflows to clear stale transient states
// This prevents showing WebSocket errors from expired Browserbase sessions
function sanitizeCaptureNodes(nodes: Node[]): Node[] {
  return nodes.map((node) => {
    if (node.type !== 'captureNode') return node

    const data = node.data as Record<string, unknown>
    const status = data.status as string | undefined
    const hasOutput = Boolean(data.videoUrl)

    // Always clear liveViewUrl (sessions expire)
    const needsClearLiveView = Boolean(data.liveViewUrl)

    // Only reset transient states if there's no output
    const transientStates = ['connecting', 'live', 'capturing']
    const isTransient = status && transientStates.includes(status)

    if (isTransient && !hasOutput) {
      // No output - reset to idle
      return {
        ...node,
        data: {
          ...data,
          status: 'idle',
          liveViewUrl: undefined,
          sessionId: undefined,
          error: undefined,
          progress: 0,
          currentFrame: 0,
          statusMessage: '',
        },
      }
    }

    if (isTransient && hasOutput) {
      // Has output but stuck in transient state - mark as complete
      return {
        ...node,
        data: {
          ...data,
          status: 'complete',
          liveViewUrl: undefined,
          sessionId: undefined,
          progress: 100,
          statusMessage: '',
        },
      }
    }

    // Clear stale liveViewUrl for complete/error states
    if (needsClearLiveView) {
      return {
        ...node,
        data: {
          ...data,
          liveViewUrl: undefined,
        },
      }
    }

    return node
  })
}

export type WorkflowCanvasHandle = {
  runWorkflow: () => Promise<void>
  openSaveModal: () => void
  loadTemplate: (templateId: string) => Promise<void>
  getNodes: () => Node[]
}

type WorkflowCanvasProps = {
  workflowId?: string
  router?: AppRouterInstance
  onZoomChange?: (zoom: number) => void
  onBackgroundBrightnessChange?: (brightness: number) => void
  backgroundBrightness?: number
  hideControls?: boolean
  /** Demo mode - skip auth and DB, show static demo state */
  demoMode?: boolean
}

const nodeTypes: NodeTypes = {
  imageNode: ImageNode,
  promptNode: PromptNode,
  codeNode: CodeNode,
  textInputNode: TextInputNode,
  stickyNoteNode: StickyNoteNode,
  captureNode: CaptureNode,
}

const edgeTypes: EdgeTypes = {
  curved: BezierEdge,
}

const defaultEdgeOptions = {
  type: "curved",
}

// Stable references for ReactFlow props to prevent unnecessary re-renders
const panOnDragButtons: [number, number] = [1, 2]
const fitViewOptions = { padding: 0.2 }

const WorkflowCanvasInner = forwardRef<WorkflowCanvasHandle, WorkflowCanvasProps>(({ workflowId: propWorkflowId, router, onZoomChange, onBackgroundBrightnessChange, backgroundBrightness = 100, hideControls, demoMode = false }, ref) => {
  // Auth context for gating actions
  const { requireAuth } = useAuth()
  
  // Use synced state for nodes and edges - keeps React state and refs in sync atomically
  const [nodes, setNodes, nodesRef] = useSyncedState<Node[]>([])
  const [edges, setEdges, edgesRef] = useSyncedState<Edge[]>(initialEdges.map((e) => ({ ...e, type: "curved" })))
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
  const workflowNameRef = useRef<string | null>(null)
  const hasAutoNamedRef = useRef(false)
  const [isInitialized, setIsInitialized] = useState(false)

  // Track consecutive auto-save failures for user notification
  const consecutiveFailuresRef = useRef(0)
  // Execution lock to prevent workflow state divergence during async execution
  const [setIsExecuting, isExecutingRef] = useSyncedRef(false)
  // Save lock to prevent concurrent auto-save operations
  const [setIsSaving, isSavingRef] = useSyncedRef(false)
  // Promise that resolves when current save completes (avoids busy-wait polling)
  const saveCompletionRef = useRef<Promise<void> | null>(null)
  // Debounce timer for auto-save
  const saveDebounceRef = useRef<NodeJS.Timeout | null>(null)

  // History management for undo/redo
  const { pushToHistory, undoImpl, redoImpl, initializeHistory } = useWorkflowHistory({
    nodesRef,
    edgesRef,
    setNodes,
    setEdges,
    isExecutingRef,
  })

  // Capture node handling
  const { handleCaptureNode: handleCaptureNodeInternal, handleStopCapture } = useCaptureNode({
    nodesRef,
    setNodes,
    userIdRef,
  })

  // Auth-gated wrapper for capture - opens auth modal if not authenticated
  const handleCaptureNode = useCallback((nodeId: string) => {
    if (!requireAuth()) {
      return
    }
    return handleCaptureNodeInternal(nodeId)
  }, [requireAuth, handleCaptureNodeInternal])

  // Node execution (single node runs)
  const { handleRunNode: handleRunNodeInternal, abortAllExecutions } = useNodeExecution({
    nodesRef,
    edgesRef,
    setNodes,
    setEdges,
    userIdRef,
    workflowId: workflowId as React.RefObject<string>,
  })

  // Auth-gated wrapper for run - opens auth modal if not authenticated
  const handleRunNode = useCallback((nodeId: string, prompt: string, model: string) => {
    if (!requireAuth()) {
      // Return void to match the internal function's return type
      return Promise.resolve()
    }
    return handleRunNodeInternal(nodeId, prompt, model)
  }, [requireAuth, handleRunNodeInternal])

  // Workflow execution (run all nodes in dependency order)
  const { runWorkflow } = useWorkflowExecution({
    nodesRef,
    edgesRef,
    isInitialized,
    isExecutingRef,
    setIsExecuting,
    handleRunNode: handleRunNodeInternal, // Use internal version for workflow execution
  })

  // Initialize workflow on mount - authenticate user, then load specific workflow or create new
  const initWorkflow = useCallback(async () => {
    // Demo mode - skip auth entirely, just show demo state
    if (demoMode) {
      const initialNodesWithUrls = createInitialNodes(
        "/placeholders/seed-hero.webp",
        "/placeholders/integrated-bio.webp",
        "/placeholders/combined-output.webp"
      )
      const initialEdgesWithType = initialEdges.map((e) => ({ ...e, type: "curved" as const }))
      setNodes(initialNodesWithUrls)
      setEdges(initialEdgesWithType)
      setIsInitialized(true)
      initializeHistory({ nodes: initialNodesWithUrls, edges: initialEdgesWithType })
      return
    }

    // Get the current authenticated user (no longer creates anonymous users)
    const userId = await initializeUser()

    if (!userId) {
      // User is not authenticated - show demo state
      // This is expected for logged-out users on workflow routes
      logger.info('No authenticated user - showing demo state')
      
      const initialNodesWithUrls = createInitialNodes(
        "/placeholders/seed-hero.webp",
        "/placeholders/integrated-bio.webp",
        "/placeholders/combined-output.webp"
      )
      const initialEdgesWithType = initialEdges.map((e) => ({ ...e, type: "curved" as const }))
      setNodes(initialNodesWithUrls)
      setEdges(initialEdgesWithType)
      setIsInitialized(true)
      initializeHistory({ nodes: initialNodesWithUrls, edges: initialEdgesWithType })
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
            // Sanitize capture nodes to clear stale transient states (e.g., expired liveViewUrl)
            const restoredNodes = sanitizeCaptureNodes(workflowData.nodes)
            const restoredEdges = workflowData.edges.map((e) => ({ ...e, type: "curved" as const }))

            setNodes(restoredNodes)
            setEdges(restoredEdges)
            workflowId.current = workflowData.id
            workflowNameRef.current = workflowData.name
            setIsInitialized(true)
            initializeHistory({ nodes: restoredNodes, edges: restoredEdges })

            logger.info('Loaded workflow by ID', {
              workflowId: workflowData.id,
              userId,
              nodeCount: restoredNodes.length,
              edgeCount: restoredEdges.length,
            })
            return
          } else if (workflowData.name === "Blank Workflow") {
            // Explicitly blank workflow - keep empty (no template)
            setNodes([])
            setEdges([])
            workflowId.current = propWorkflowId
            workflowNameRef.current = workflowData.name
            setIsInitialized(true)
            initializeHistory({ nodes: [], edges: [] })

            logger.info('Loaded blank workflow', { workflowId: propWorkflowId })
            return
          } else {
            // Workflow exists but is empty - initialize with appropriate template based on tool_type
            const toolType = workflowData.tool_type
            // Validate tool_type exists in config before using
            const isValidToolType = toolType && toolType in TOOL_WORKFLOW_CONFIG
            const toolConfig = isValidToolType ? TOOL_WORKFLOW_CONFIG[toolType as ToolWorkflowType] : null
            
            logger.info('Empty workflow found, initializing with template', { 
              workflowId: propWorkflowId,
              toolType,
              isValidToolType,
            })

            let templateNodes: Node[]
            let templateEdges: Edge[]

            // Use tool-specific template if available and not style-fusion, otherwise use default
            if (isValidToolType && toolConfig && toolType !== "style-fusion") {
              try {
                const template = toolConfig.createWorkflow()
                // Generate new UUIDs for nodes to ensure they can be saved
                const nodeIdMap = new Map<string, string>()
                templateNodes = template.nodes.map((node) => {
                  const newId = crypto.randomUUID()
                  nodeIdMap.set(node.id, newId)
                  return { ...node, id: newId }
                })
                templateEdges = template.edges.map((edge) => {
                  const newSource = nodeIdMap.get(edge.source)
                  const newTarget = nodeIdMap.get(edge.target)
                  if (!newSource || !newTarget) {
                    logger.warn('Edge references unknown node in template', { 
                      toolType, 
                      edgeId: edge.id,
                      source: edge.source,
                      target: edge.target,
                    })
                  }
                  return {
                    ...edge,
                    id: crypto.randomUUID(),
                    source: newSource || edge.source,
                    target: newTarget || edge.target,
                    type: "curved" as const,
                  }
                })
              } catch (error) {
                // Fall back to default template if tool template creation fails
                logger.error('Failed to create tool workflow template, using default', { 
                  toolType, 
                  error: error instanceof Error ? error.message : String(error),
                })
                const { seedHeroUrl, integratedBioUrl, combinedOutputUrl } = getSeedImageUrls()
                templateNodes = createInitialNodes(seedHeroUrl, integratedBioUrl, combinedOutputUrl)
                templateEdges = initialEdges.map((e) => ({ ...e, type: "curved" as const }))
              }
            } else {
              // Default style-fusion template
              const { seedHeroUrl, integratedBioUrl, combinedOutputUrl } = getSeedImageUrls()
              templateNodes = createInitialNodes(seedHeroUrl, integratedBioUrl, combinedOutputUrl)
              templateEdges = initialEdges.map((e) => ({ ...e, type: "curved" as const }))
            }

            setNodes(templateNodes)
            setEdges(templateEdges)
            workflowId.current = propWorkflowId
            setIsInitialized(true)
            initializeHistory({ nodes: templateNodes, edges: templateEdges })

            // Save initial nodes to the workflow in parallel
            await Promise.all([
              saveNodes(propWorkflowId, templateNodes),
              saveEdges(propWorkflowId, templateEdges),
            ])

            logger.info('Initialized empty workflow with template', { toolType })
            return
          }
        } else {
          logger.error('Workflow not found', { workflowId: propWorkflowId })
          toast.error("Workflow not found", {
            description: "This workflow doesn't exist or you don't have access to it.",
          })
        }
      } catch (error) {
        logger.error('Failed to load workflow by ID', {
          workflowId: propWorkflowId,
          error: error instanceof Error ? error.message : String(error),
          userId,
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
            // Sanitize capture nodes to clear stale transient states (e.g., expired liveViewUrl)
            const restoredNodes = sanitizeCaptureNodes(workflowData.nodes)
            const restoredEdges = workflowData.edges.map((e) => ({ ...e, type: "curved" as const }))

            setNodes(restoredNodes)
            setEdges(restoredEdges)
            workflowId.current = workflowData.id
            setIsInitialized(true)
            initializeHistory({ nodes: restoredNodes, edges: restoredEdges })

            logger.info('Restored most recent workflow', {
              workflowId: workflowData.id,
              userId,
              nodeCount: restoredNodes.length,
              edgeCount: restoredEdges.length,
            })
            return
          }
        }
      } catch (error) {
        logger.error('Failed to load existing workflow, creating new', {
          error: error instanceof Error ? error.message : String(error),
          userId,
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
    const initialEdgesWithType = initialEdges.map((e) => ({ ...e, type: "curved" as const }))

    setNodes(initialNodesWithUrls)
    setEdges(initialEdgesWithType)
    setIsInitialized(true)
    initializeHistory({ nodes: initialNodesWithUrls, edges: initialEdgesWithType })

    // Create workflow in background - non-blocking
    createWorkflow(userId, "My Workflow")
      .then((wfId) => {
        if (wfId) {
          workflowId.current = wfId
          logger.info('Created new workflow', { workflowId: wfId, userId })
        } else {
          logger.error('createWorkflow returned null - workflow will not be saved')
          toast.warning("Could not connect to cloud storage", {
            description: "Your work will not be saved. Check your connection and refresh to retry.",
            duration: 10000,
          })
        }
      })
      .catch((error) => {
        logger.error('Failed to create workflow', {
          error: error instanceof Error ? error.message : String(error),
          userId,
        })
        toast.warning("Could not connect to cloud storage", {
          description: "Your work will not be saved. Check your connection and refresh to retry.",
          duration: 10000,
        })
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- setNodes/setEdges from useSyncedState are stable
  }, [propWorkflowId, initializeHistory, demoMode])

  // Auto-save to Supabase (called by debouncedSave)
  const saveToSupabase = useCallback(async () => {
    if (!workflowId.current || !isInitialized) return

    // Don't auto-save during execution - transient states
    if (isExecutingRef.current) return

    // Prevent concurrent saves to avoid race conditions
    if (isSavingRef.current) return

    setIsSaving(true)

    // Create a Promise that external code can await for save completion
    const savePromise = (async () => {
      try {
        // Parallelize node and edge saves to reduce latency
        await Promise.all([
          saveNodes(workflowId.current!, nodesRef.current),
          saveEdges(workflowId.current!, edgesRef.current)
        ])
        // Reset failure counter on successful save
        consecutiveFailuresRef.current = 0
      } catch (error) {
        // Log auto-save failures with context for debugging
        logger.error('Failed to save workflow', {
          workflowId: workflowId.current,
          nodeCount: nodesRef.current.length,
          edgeCount: edgesRef.current.length,
          error: error instanceof Error ? error.message : String(error),
        })

        // Track consecutive failures and notify user periodically
        consecutiveFailuresRef.current++
        // Warn at threshold, then periodically to remind user of ongoing issue
        if (consecutiveFailuresRef.current === SAVE_FAILURE_WARN_THRESHOLD || 
            consecutiveFailuresRef.current % SAVE_FAILURE_REMINDER_INTERVAL === 0) {
          toast.warning('Auto-save is having issues', {
            description: 'Your changes may not be saved. Check your connection.',
            duration: 10000
          })
        }
      } finally {
        // Always release save lock
        setIsSaving(false)
        saveCompletionRef.current = null
      }
    })()

    saveCompletionRef.current = savePromise
    await savePromise
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refs (nodesRef, edgesRef, isExecutingRef, isSavingRef) are stable and intentionally excluded
  }, [isInitialized, setIsSaving])

  // Debounced save - waits 1.5s after last change before saving
  const debouncedSave = useCallback(() => {
    if (saveDebounceRef.current) {
      clearTimeout(saveDebounceRef.current)
    }
    saveDebounceRef.current = setTimeout(() => {
      saveToSupabase()
    }, 1500)
  }, [saveToSupabase])

  // Cleanup debounce timer and abort in-flight requests on unmount
  useEffect(() => {
    return () => {
      if (saveDebounceRef.current) {
        clearTimeout(saveDebounceRef.current)
      }
      // Abort all in-flight generation requests
      abortAllExecutions()
    }
  }, [abortAllExecutions])

  // Agent bridge - listen for tool execution events from the chat
  useAgentBridge({
    nodes,
    edges,
    setNodes,
    setEdges,
    pushToHistory,
    debouncedSave,
    runWorkflow,
    workflowIdRef: workflowId,
    userIdRef,
    router,
    demoMode,
  })

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

  // Node addition operations
  const {
    handleAddImageNode,
    handleAddPromptNode,
    handleAddCodeNode,
    handleAddTextInputNode,
    handleAddStickyNoteNode,
    handleAddCaptureNode,
  } = useNodeOperations({
    setNodes,
    setContextMenu,
    pushToHistory,
    debouncedSave,
  })

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

    setNodes((nds) => applyNodeChanges(changes, nds))

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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- isExecutingRef is stable, setNodes from useSyncedState is stable
  }, [pushToHistory, debouncedSave])

  const onEdgesChange = useCallback((changes: EdgeChange[]) => {
    // Block all edge changes during execution
    if (isExecutingRef.current) {
      toast.warning('Cannot modify connections during execution')
      return
    }

    setEdges((eds) => applyEdgeChanges(changes, eds))

    // Push to history and trigger save after edge changes
    pushToHistory()
    debouncedSave()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- isExecutingRef is stable, setEdges from useSyncedState is stable
  }, [pushToHistory, debouncedSave])

  // Validate connections in real-time for visual feedback
  const isValidConnection = useCallback(
    (connection: Edge | Connection) => {
      const validationResult = validateConnection(connection, nodesRef.current, edgesRef.current)
      return validationResult.valid
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refs (nodesRef, edgesRef) are stable and intentionally excluded
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
    setEdges((eds) => addEdge({ ...connection, type: "curved" }, eds))

    // Push to history and trigger save after adding connection
    pushToHistory()
    debouncedSave()

    // Auto-name workflow when first connection is made (if still has default name)
    if (
      !hasAutoNamedRef.current &&
      workflowId.current &&
      workflowNameRef.current &&
      (workflowNameRef.current.startsWith("My Workflow") ||
       workflowNameRef.current.startsWith("New Workflow") ||
       workflowNameRef.current === "Blank Workflow" ||
       workflowNameRef.current === "Untitled Workflow" ||
       // Tool default names
       workflowNameRef.current === "Style Fusion" ||
       workflowNameRef.current === "Animation Capture" ||
       workflowNameRef.current === "Text to Image")
    ) {
      hasAutoNamedRef.current = true
      // Async auto-naming - don't block UI
      const currentNodes = nodesRef.current
      const currentWorkflowId = workflowId.current
      generateWorkflowName(currentNodes).then((newName) => {
        if (newName && newName !== "Untitled Workflow") {
          renameWorkflow(currentWorkflowId, newName).then((success) => {
            if (success) {
              workflowNameRef.current = newName
              logger.info("Auto-named workflow", { workflowId: currentWorkflowId, name: newName })
            }
          })
        }
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refs (nodesRef, edgesRef, isExecutingRef) are stable, setEdges from useSyncedState is stable
  }, [pushToHistory, debouncedSave])

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
        logger.error('Error saving template', { error: error instanceof Error ? error.message : String(error) })
        toast.error("Failed to save template", {
          description: "An unexpected error occurred.",
        })
      } finally {
        setIsSavingTemplate(false)
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refs (nodesRef, edgesRef, userIdRef) are stable and intentionally excluded
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

      // Save the template nodes/edges to the new workflow in parallel
      // Sanitize capture nodes to clear any stale transient states from template
      const templateNodes = sanitizeCaptureNodes(templateData.nodes)
      const templateEdges = templateData.edges

      await Promise.all([
        saveNodes(newWorkflowId, templateNodes),
        saveEdges(newWorkflowId, templateEdges),
      ])

      toast.success("Template forked", {
        description: `Created new workflow from "${templateData.name}".`,
      })

      // Navigate to the new workflow
      router.push(`/w/${newWorkflowId}`)
    } catch (error) {
      logger.error('Error forking template', { error: error instanceof Error ? error.message : String(error) })
      toast.error("Failed to fork template", {
        description: "An unexpected error occurred.",
      })
    }
  }, [router])

  const getNodes = useCallback(() => nodesRef.current, [nodesRef])
  useImperativeHandle(ref, () => ({ runWorkflow, openSaveModal, loadTemplate, getNodes }), [runWorkflow, openSaveModal, loadTemplate, getNodes])

  // Handler for code node language changes
  const handleLanguageChange = useCallback((nodeId: string, language: string) => {
    setNodes((nds) =>
      nds.map((n) =>
        n.id === nodeId ? { ...n, data: { ...n.data, language } } : n
      )
    )
    debouncedSave()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- setNodes from useSyncedState is stable
  }, [debouncedSave])

  // Handler for text input node value changes
  const handleTextInputValueChange = useCallback((nodeId: string, value: string) => {
    setNodes((nds) =>
      nds.map((n) =>
        n.id === nodeId ? { ...n, data: { ...n.data, value } } : n
      )
    )
    debouncedSave()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- setNodes from useSyncedState is stable
  }, [debouncedSave])

  // Calculate sequence numbers for image nodes based on Y position
  // Numbers are assigned per-target-node: only inputs to the same node are numbered together
  const imageSequenceNumbers = useMemo(() => {
    try {
      const sequenceMap = new Map<string, number>()

      // Group image inputs by their target node
      const inputsByTarget = new Map<string, Node[]>()

      for (const edge of edges) {
        const sourceNode = nodes.find(n => n.id === edge.source)
        // Only include image nodes that are marked as inputs (not output images from prompt nodes)
        if (sourceNode?.type === "imageNode" && (sourceNode.data as ImageNodeData).isInput) {
          const targetId = edge.target
          if (!inputsByTarget.has(targetId)) {
            inputsByTarget.set(targetId, [])
          }
          inputsByTarget.get(targetId)!.push(sourceNode)
        }
      }

      // For each target node with 2+ image inputs, assign sequence numbers
      for (const [, inputNodes] of inputsByTarget) {
        if (inputNodes.length < 2) continue

        // Filter out nodes without valid positions before sorting
        const nodesWithValidPosition = inputNodes.filter(
          n => n.position && typeof n.position.y === "number" && Number.isFinite(n.position.y)
        )

        // Sort by Y position (top to bottom), then by X position (left to right) for nodes at same Y
        // This ensures deterministic ordering when nodes are horizontally aligned
        const sortedNodes = [...nodesWithValidPosition].sort((a, b) => {
          const yDiff = a.position!.y - b.position!.y
          if (yDiff !== 0) return yDiff
          // Secondary sort by X position when Y positions are exactly equal
          return (a.position!.x || 0) - (b.position!.x || 0)
        })

        sortedNodes.forEach((node, index) => {
          sequenceMap.set(node.id, index + 1)
        })
      }

      return sequenceMap
    } catch (error) {
      logger.error('Error calculating sequence numbers', {
        error: error instanceof Error ? error.message : String(error),
        nodeCount: nodes.length,
      })
      return new Map<string, number>()
    }
  }, [nodes, edges])

  // Inject handlers and sequence numbers - stabilized with useCallback to prevent re-renders
  const nodesWithHandlers = useMemo(() => {
    return nodes.map((node) => {
      if (node.type === "promptNode") {
        // Only update if handler is different
        if (node.data.onRun === handleRunNode) return node
        return { ...node, data: { ...node.data, onRun: handleRunNode } }
      }
      if (node.type === "codeNode") {
        // Only update if handler is different
        if (node.data.onLanguageChange === handleLanguageChange) return node
        return {
          ...node,
          data: {
            ...node.data,
            onLanguageChange: handleLanguageChange
          }
        }
      }
      if (node.type === "imageNode") {
        const sequenceNumber = imageSequenceNumbers.get(node.id)
        // Only update if sequence number changed
        if (node.data.sequenceNumber === sequenceNumber) return node
        return {
          ...node,
          data: {
            ...node.data,
            sequenceNumber
          }
        }
      }
      if (node.type === "textInputNode") {
        // Only update if handler is different
        if (node.data.onValueChange === handleTextInputValueChange) return node
        return {
          ...node,
          data: {
            ...node.data,
            onValueChange: handleTextInputValueChange
          }
        }
      }
      if (node.type === "captureNode") {
        // Only update if handlers are different
        if (node.data.onCapture === handleCaptureNode && node.data.onStop === handleStopCapture) return node
        return {
          ...node,
          data: {
            ...node.data,
            onCapture: handleCaptureNode,
            onStop: handleStopCapture
          }
        }
      }
      return node
    })
  }, [nodes, handleRunNode, handleLanguageChange, imageSequenceNumbers, handleTextInputValueChange, handleCaptureNode, handleStopCapture])

  const handleDeleteSelected = useCallback(() => {
    if (selectedNodes.length === 0) return

    // Show confirmation dialog
    setShowDeleteConfirmation(true)
  }, [selectedNodes])

  // Stabilized callbacks for NodeToolbar to prevent re-renders
  const toolbarCallbacks = useMemo(() => ({
    onAddImageNode: () => handleAddImageNode({ x: 400, y: 300 }),
    onAddPromptNode: (outputType: "image" | "text") => handleAddPromptNode({ x: 400, y: 300 }, outputType),
    onAddCodeNode: () => handleAddCodeNode({ x: 400, y: 300 }),
    onAddTextInputNode: () => handleAddTextInputNode({ x: 400, y: 300 }),
    onAddStickyNoteNode: () => handleAddStickyNoteNode({ x: 400, y: 300 }),
    onAddCaptureNode: () => handleAddCaptureNode({ x: 400, y: 300 }),
    onDeleteSelected: handleDeleteSelected,
  }), [handleAddImageNode, handleAddPromptNode, handleAddCodeNode, handleAddTextInputNode, handleAddStickyNoteNode, handleAddCaptureNode, handleDeleteSelected])

  const confirmDelete = useCallback(async (skipFutureConfirmations: boolean = false) => {
    if (selectedNodes.length === 0) return

    // Store the count before clearing selection
    const deletedCount = selectedNodes.length

    // Save preference if user checked "don't show again"
    if (skipFutureConfirmations && typeof window !== "undefined") {
      localStorage.setItem('motif_skip_delete_confirmation', 'true')
      logger.debug('User enabled skip confirmation for future deletions')
    }

    setNodes((nds) => nds.filter((n) => !selectedNodes.includes(n.id)))
    setEdges((eds) => eds.filter((e) => !selectedNodes.includes(e.source) && !selectedNodes.includes(e.target)))
    pushToHistory()

    // Cancel any pending debounced saves
    if (saveDebounceRef.current) {
      clearTimeout(saveDebounceRef.current)
    }

    // Wait for any in-flight saves to complete using Promise (avoids busy-wait polling)
    if (saveCompletionRef.current) {
      try {
        await Promise.race([
          saveCompletionRef.current,
          new Promise((_, reject) => setTimeout(() => reject(new Error('Save timeout')), 5000))
        ])
      } catch {
        logger.warn('Timed out waiting for in-flight save to complete')
      }
    }

    // Force immediate save for destructive actions
    logger.debug('Attempting to save deletion', {
      workflowId: workflowId.current,
      isInitialized,
      nodeCount: nodesRef.current.length,
      edgeCount: edgesRef.current.length,
    })

    if (workflowId.current && isInitialized) {
      setIsSaving(true)
      try {
        logger.debug('Saving nodes...')
        await saveNodes(workflowId.current, nodesRef.current)
        logger.debug('Nodes saved successfully')

        logger.debug('Saving edges...')
        await saveEdges(workflowId.current, edgesRef.current)
        logger.debug('Edges saved successfully')

        consecutiveFailuresRef.current = 0
      } catch (error) {
        logger.error('Failed to save after deletion', { error: error instanceof Error ? error.message : String(error) })
        toast.error('Failed to save deletion', {
          description: 'Your changes may not be persisted. Please try again.',
        })
      } finally {
        setIsSaving(false)
      }
    } else {
      logger.warn('Cannot save - missing workflowId or not initialized', {
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
      description: `Removed ${deletedCount} ${deletedCount === 1 ? "node" : "nodes"}`,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refs (nodesRef, edgesRef) are stable, setNodes/setEdges from useSyncedState are stable
  }, [selectedNodes, pushToHistory, isInitialized, setIsSaving])

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

  // Refs for latest callback values to avoid effect re-runs
  const selectedNodesRef = useRef(selectedNodes)
  const handleDeleteSelectedRef = useRef(handleDeleteSelected)
  const confirmDeleteRef = useRef(confirmDelete)
  const undoRef = useRef(undo)
  const redoRef = useRef(redo)

  // Keep refs in sync with latest values
  selectedNodesRef.current = selectedNodes
  handleDeleteSelectedRef.current = handleDeleteSelected
  confirmDeleteRef.current = confirmDelete
  undoRef.current = undo
  redoRef.current = redo

  // Delete key handler - stable, only runs once on mount
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.key === "Delete" || e.key === "Backspace") && selectedNodesRef.current.length > 0) {
        const activeElement = document.activeElement
        if (activeElement?.tagName === "INPUT" || activeElement?.tagName === "TEXTAREA") return

        // Check if user has disabled confirmation dialogs (with SSR guard)
        const skipConfirmation = typeof window !== "undefined" && localStorage.getItem('motif_skip_delete_confirmation') === 'true'

        if (skipConfirmation) {
          // Delete immediately without confirmation
          confirmDeleteRef.current(false)
        } else {
          // Show confirmation dialog
          handleDeleteSelectedRef.current()
        }
      }
    }
    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [])

  // Undo/Redo keyboard shortcuts - stable, only runs once on mount
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
        undoRef.current()
      }

      // Cmd/Ctrl + Shift + Z or Ctrl + Y for redo
      if ((modifier && e.shiftKey && e.key === 'z') || (e.ctrlKey && e.key === 'y')) {
        e.preventDefault()
        redoRef.current()
      }
    }

    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [])

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
        panOnDrag={panOnDragButtons}
        zoomOnScroll
        zoomOnPinch
        fitView
        fitViewOptions={fitViewOptions}
        onMove={handleMove}
        onContextMenu={handlePaneContextMenu}
        className="bg-transparent touch-pan-x touch-pan-y"
      />

      {contextMenu && (
        <ContextMenu
          ref={contextMenuRef}
          x={contextMenu.x}
          y={contextMenu.y}
          flowX={contextMenu.flowX}
          flowY={contextMenu.flowY}
          onAddImageNode={handleAddImageNode}
          onAddImageGenPrompt={handleAddPromptNode}
          onAddTextGenPrompt={handleAddPromptNode}
          onAddCodeNode={handleAddCodeNode}
          onAddTextInputNode={handleAddTextInputNode}
          onAddStickyNoteNode={handleAddStickyNoteNode}
          onAddCaptureNode={handleAddCaptureNode}
          onSaveWorkflow={openSaveModal}
        />
      )}

      {!hideControls && (
        <>
          {/* Canvas zoom controls - positioned bottom-right, above command menu */}
          <div className="absolute bottom-16 right-4 z-10">
            <div 
              className="flex flex-col rounded-lg shadow-sm transition-colors duration-150"
              style={{
                backgroundColor: `rgba(255, 255, 255, ${backgroundBrightness / 100})`,
                borderColor: backgroundBrightness > 50 ? 'rgba(0, 0, 0, 0.1)' : 'rgba(255, 255, 255, 0.1)',
                borderWidth: '1px',
                borderStyle: 'solid',
              }}
            >
              <button
                onClick={() => zoomIn()}
                className="p-2 transition-colors rounded-t-lg"
                style={{ color: backgroundBrightness > 50 ? 'rgba(0, 0, 0, 0.6)' : 'var(--muted-foreground)' }}
                aria-label="Zoom in"
              >
                <Plus className="w-4 h-4" />
              </button>
              <button
                onClick={() => zoomOut()}
                className="p-2 transition-colors"
                style={{ 
                  color: backgroundBrightness > 50 ? 'rgba(0, 0, 0, 0.6)' : 'var(--muted-foreground)',
                  borderTopWidth: '1px',
                  borderTopStyle: 'solid',
                  borderTopColor: backgroundBrightness > 50 ? 'rgba(0, 0, 0, 0.1)' : 'var(--border)',
                }}
                aria-label="Zoom out"
              >
                <Minus className="w-4 h-4" />
              </button>
              <button
                onClick={() => fitView(fitViewOptions)}
                className="p-2 transition-colors"
                style={{ 
                  color: backgroundBrightness > 50 ? 'rgba(0, 0, 0, 0.6)' : 'var(--muted-foreground)',
                  borderTopWidth: '1px',
                  borderTopStyle: 'solid',
                  borderTopColor: backgroundBrightness > 50 ? 'rgba(0, 0, 0, 0.1)' : 'var(--border)',
                }}
                aria-label="Fit view"
              >
                <Maximize className="w-4 h-4" />
              </button>
              {onBackgroundBrightnessChange && (
                <VisualControls
                  backgroundBrightness={backgroundBrightness}
                  onBackgroundBrightnessChange={onBackgroundBrightnessChange}
                />
              )}
            </div>
          </div>

          {/* V0 Badge - bottom right */}
          {demoMode && (
            <div className="absolute bottom-4 right-[20%] z-10">
              <V0Badge fixed={false} />
            </div>
          )}

          <NodeToolbar
            onAddImageNode={toolbarCallbacks.onAddImageNode}
            onAddPromptNode={toolbarCallbacks.onAddPromptNode}
            onAddCodeNode={toolbarCallbacks.onAddCodeNode}
            onAddTextInputNode={toolbarCallbacks.onAddTextInputNode}
            onAddStickyNoteNode={toolbarCallbacks.onAddStickyNoteNode}
            onAddCaptureNode={toolbarCallbacks.onAddCaptureNode}
            onDeleteSelected={toolbarCallbacks.onDeleteSelected}
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

      {/* Agent Chat Widget */}
      {!hideControls && <AgentChat workflowId={workflowId.current ?? undefined} />}
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
