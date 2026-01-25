"use client"

import type React from "react"
import { useRef, useCallback, useState, useEffect, useMemo } from "react"
import Link from "next/link"
import {
  ReactFlow,
  ReactFlowProvider,
  addEdge,
  applyNodeChanges,
  applyEdgeChanges,
  useReactFlow,
  type Connection,
  type Edge,
  type Node,
  type NodeChange,
  type EdgeChange,
} from "@xyflow/react"
import "@xyflow/react/dist/style.css"
import { ZoomIn, ZoomOut, Maximize } from "lucide-react"
import { toast } from "sonner"
import { ImageNode } from "@/components/workflow/image-node"
import { PromptNode } from "@/components/workflow/prompt-node"
import { CodeNode } from "@/components/workflow/code-node"
import { TextInputNode } from "@/components/workflow/text-input-node"
import { StickyNoteNode } from "@/components/workflow/sticky-note-node"
import { CaptureNode } from "@/components/workflow/capture-node"
import { WorkflowErrorBoundary } from "@/components/workflow/workflow-error-boundary"
import { TOOL_WORKFLOW_CONFIG, type ToolWorkflowType } from "@/lib/workflow/tool-workflows"
import { getAllInputsFromNodes } from "@/lib/workflow/image-utils"
import { captureAnimation, formatAnimationContextAsMarkdown } from "@/lib/hooks/use-capture-animation"
import { useSyncedState } from "@/lib/hooks/use-synced-state"
import { initializeUser } from "@/lib/supabase/workflows"
import { ToolsMenu } from "@/components/tools-menu"
import { NodeToolbar } from "@/components/workflow/node-toolbar"
import { ContextMenu } from "@/components/workflow/context-menu"
import { createImageNode, createPromptNode, createCodeNode, createTextInputNode, createStickyNoteNode, createCaptureNode } from "@/lib/workflow/node-factories"
import { MotifLogo } from "@/components/motif-logo"
import { logger } from "@/lib/logger"

const nodeTypes = {
  imageNode: ImageNode,
  promptNode: PromptNode,
  codeNode: CodeNode,
  textInputNode: TextInputNode,
  stickyNoteNode: StickyNoteNode,
  captureNode: CaptureNode,
}

const CurvedEdge = ({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  style,
  markerEnd,
}: {
  id: string
  sourceX: number
  sourceY: number
  targetX: number
  targetY: number
  style?: React.CSSProperties
  markerEnd?: string
}) => {
  const curvature = 0.5
  const centerX = (sourceX + targetX) / 2
  const controlX1 = sourceX + (centerX - sourceX) * curvature
  const controlX2 = targetX - (targetX - centerX) * curvature

  return (
    <path
      id={id}
      style={style}
      className="react-flow__edge-path"
      d={`M ${sourceX},${sourceY} C ${controlX1},${sourceY} ${controlX2},${targetY} ${targetX},${targetY}`}
      markerEnd={markerEnd}
    />
  )
}

const edgeTypes = {
  curved: CurvedEdge,
}

// Stable reference for defaultEdgeOptions to prevent ReactFlow re-renders
const defaultEdgeOptions = {
  type: "curved" as const,
  style: { stroke: "#94a3b8", strokeWidth: 2 },
}

function ToolCanvasContent({ tool }: { tool: ToolWorkflowType }) {
  const config = TOOL_WORKFLOW_CONFIG[tool]
  const { fitView, zoomIn, zoomOut } = useReactFlow()

  const [workflow] = useState(() => config.createWorkflow())
  // Use synced state hook to keep state and refs in sync automatically
  const [nodes, setNodesWithRef, nodesRef] = useSyncedState<Node[]>(workflow.nodes)
  const [edges, setEdgesWithRef, edgesRef] = useSyncedState<Edge[]>(workflow.edges)
  const abortControllerRef = useRef<AbortController | null>(null)
  const userIdRef = useRef<string | null>(null)

  // Initialize user on mount (creates anonymous user if needed)
  useEffect(() => {
    initializeUser().then((userId) => {
      userIdRef.current = userId
    })
  }, [])

  const [contextMenu, setContextMenu] = useState<{
    x: number
    y: number
    flowPosition: { x: number; y: number }
  } | null>(null)

  // Handle ReactFlow node changes and keep ref in sync
  const onNodesChange = useCallback((changes: NodeChange[]) => {
    setNodesWithRef((nds) => applyNodeChanges(changes, nds))
  }, [setNodesWithRef])

  // Handle ReactFlow edge changes and keep ref in sync
  const onEdgesChange = useCallback((changes: EdgeChange[]) => {
    setEdgesWithRef((eds) => applyEdgeChanges(changes, eds))
  }, [setEdgesWithRef])

  const handleAddImageNode = useCallback(
    (position?: { x: number; y: number }) => {
      const newNode = createImageNode(position || { x: 100, y: 100 })
      setNodesWithRef((nds) => [...nds, newNode])
      setContextMenu(null)
    },
    [setNodesWithRef],
  )

  const handleAddPromptNode = useCallback(
    (outputType: "image" | "text", position?: { x: number; y: number }) => {
      const newNode = createPromptNode(position || { x: 100, y: 100 }, outputType)
      setNodesWithRef((nds) => [...nds, newNode])
      setContextMenu(null)
    },
    [setNodesWithRef],
  )

  const handleAddCodeNode = useCallback(
    (position?: { x: number; y: number }) => {
      const newNode = createCodeNode(position || { x: 100, y: 100 })
      setNodesWithRef((nds) => [...nds, newNode])
      setContextMenu(null)
    },
    [setNodesWithRef],
  )

  const handleAddTextInputNode = useCallback(
    (position?: { x: number; y: number }) => {
      const newNode = createTextInputNode(position || { x: 100, y: 100 })
      setNodesWithRef((nds) => [...nds, newNode])
      setContextMenu(null)
    },
    [setNodesWithRef],
  )

  const handleAddStickyNoteNode = useCallback(
    (position?: { x: number; y: number }) => {
      const newNode = createStickyNoteNode(position || { x: 100, y: 100 })
      setNodesWithRef((nds) => [...nds, newNode])
      setContextMenu(null)
    },
    [setNodesWithRef],
  )

  const handleAddCaptureNode = useCallback(
    (position?: { x: number; y: number }) => {
      const newNode = createCaptureNode(position || { x: 100, y: 100 })
      setNodesWithRef((nds) => [...nds, newNode])
      setContextMenu(null)
    },
    [setNodesWithRef],
  )

  const handleTextInputValueChange = useCallback(
    (nodeId: string, value: string) => {
      setNodesWithRef((nds) =>
        nds.map((n) => (n.id === nodeId ? { ...n, data: { ...n.data, value } } : n))
      )
    },
    [setNodesWithRef],
  )

  // Stabilized callbacks for context menu and toolbar
  const contextMenuCallbacks = useMemo(() => ({
    onAddImageNode: handleAddImageNode,
    onAddImageGenPrompt: (position: { x: number; y: number }, outputType: "image" | "text") => handleAddPromptNode(outputType, position),
    onAddTextGenPrompt: (position: { x: number; y: number }, outputType: "image" | "text") => handleAddPromptNode(outputType, position),
    onAddCodeNode: handleAddCodeNode,
    onAddTextInputNode: handleAddTextInputNode,
    onAddStickyNoteNode: handleAddStickyNoteNode,
    onAddCaptureNode: handleAddCaptureNode,
  }), [handleAddImageNode, handleAddPromptNode, handleAddCodeNode, handleAddTextInputNode, handleAddStickyNoteNode, handleAddCaptureNode])

  const toolbarCallbacks = useMemo(() => ({
    onAddImageNode: () => handleAddImageNode(),
    onAddPromptNode: handleAddPromptNode,
    onAddCodeNode: () => handleAddCodeNode(),
    onAddTextInputNode: () => handleAddTextInputNode(),
    onAddStickyNoteNode: () => handleAddStickyNoteNode(),
    onAddCaptureNode: () => handleAddCaptureNode(),
    onDeleteSelected: () => {},
  }), [handleAddImageNode, handleAddPromptNode, handleAddCodeNode, handleAddTextInputNode, handleAddStickyNoteNode, handleAddCaptureNode])

  // Cleanup: abort in-flight requests on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [])

  const handleContextMenu = useCallback((event: React.MouseEvent) => {
    event.preventDefault()
    const bounds = (event.target as HTMLElement).closest(".react-flow")?.getBoundingClientRect()
    if (bounds) {
      setContextMenu({
        x: event.clientX,
        y: event.clientY,
        flowPosition: {
          x: event.clientX - bounds.left,
          y: event.clientY - bounds.top,
        },
      })
    }
  }, [])

  const onConnect = useCallback(
    (params: Connection) => {
      setEdgesWithRef((eds) => addEdge({ ...params, type: "curved" }, eds))
    },
    [setEdgesWithRef],
  )

  // Get target output language from connected code node
  const getTargetLanguage = useCallback((promptNodeId: string): string | undefined => {
    const outputEdge = edgesRef.current.find((e) => e.source === promptNodeId)
    if (!outputEdge) return undefined
    
    const targetNode = nodesRef.current.find((n) => n.id === outputEdge.target)
    if (targetNode?.type === "codeNode") {
      return (targetNode.data.language as string) || "css"
    }
    return undefined
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refs (edgesRef, nodesRef) are stable and intentionally excluded
  }, [])

  const handleRunNode = useCallback(
    async (nodeId: string, prompt: string, model: string) => {
      // Collect all inputs (images and text from code nodes)
      const allInputs = getAllInputsFromNodes(nodeId, nodesRef.current, edgesRef.current)

      // Get target language from connected code output node
      const targetLanguage = getTargetLanguage(nodeId)

      // Check if this is a capture mode node
      const currentNode = nodesRef.current.find(n => n.id === nodeId)
      const isCaptureMode = currentNode?.data?.captureMode === true

      setNodesWithRef((nds) => nds.map((n) => (n.id === nodeId ? { ...n, data: { ...n.data, status: "running" } } : n)))

      try {
        // Abort any previous request and create new AbortController
        if (abortControllerRef.current) {
          abortControllerRef.current.abort()
        }
        abortControllerRef.current = new AbortController()
        const signal = abortControllerRef.current.signal

        let resultText: string | undefined

        if (isCaptureMode) {
          // Animation capture mode
          const urlInput = allInputs.textInputs.find(t => t.label?.toLowerCase().includes('url'))
          const selectorInput = allInputs.textInputs.find(t => t.label?.toLowerCase().includes('selector'))

          if (!urlInput?.content) {
            throw new Error('Website URL is required for animation capture')
          }

          const userId = userIdRef.current
          if (!userId) {
            throw new Error('Authentication required for animation capture. Please refresh the page.')
          }

          toast.info('Starting animation capture...', {
            description: `Capturing animations from ${urlInput.content}`,
            duration: 5000,
          })

          const captureResult = await captureAnimation(
            {
              url: urlInput.content,
              selector: selectorInput?.content || undefined,
              duration: 3000,
              userId,
            },
            {
              signal,
              onStatusChange: (status) => {
                if (status === 'processing') {
                  toast.info('Processing capture...', {
                    description: 'Browser session active, capturing animation frames',
                    duration: 10000,
                  })
                }
              },
            }
          )

          resultText = formatAnimationContextAsMarkdown(captureResult)
          toast.success('Animation captured!', {
            description: `Captured ${captureResult.animationContext?.frames?.length || 0} frames`,
          })
        } else {
          // Regular generation mode
          const response = await fetch("/api/generate-image", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              prompt,
              model,
              images: allInputs.images,
              textInputs: allInputs.textInputs,
              targetLanguage,
            }),
            signal,
          })

          const data = await response.json()

          // Handle rate limiting specifically
          if (response.status === 429) {
            const resetTime = data.reset ? new Date(data.reset).toLocaleTimeString() : "soon"
            const limitMessage = data.message || "Rate limit exceeded."
            throw new Error(`${limitMessage} Please try again at ${resetTime}.`)
          }

          // Handle other HTTP errors
          if (!response.ok) {
            throw new Error(data.error || data.message || `HTTP ${response.status}: Generation failed`)
          }

          if (!data.success) {
            setNodesWithRef((nds) => nds.map((n) => (n.id === nodeId ? { ...n, data: { ...n.data, status: "error" } } : n)))
            toast.error("Generation failed", {
              description: data.error || "Unknown error occurred",
            })
            return
          }

          resultText = data.text
        }

        if (resultText) {
          setNodesWithRef((nds) => {
            const updatedNodes = nds.map((n) => {
              if (n.id === nodeId) {
                return { ...n, data: { ...n.data, status: "complete" } }
              }
              return n
            })

            const outputEdge = edgesRef.current.find((e) => e.source === nodeId)
            if (outputEdge) {
              const outputNodeId = outputEdge.target
              return updatedNodes.map((n) => {
                if (n.id === outputNodeId && n.type === "codeNode") {
                  return { ...n, data: { ...n.data, content: resultText } }
                }
                return n
              })
            }

            return updatedNodes
          })
        } else {
          setNodesWithRef((nds) => nds.map((n) => (n.id === nodeId ? { ...n, data: { ...n.data, status: "error" } } : n)))
          toast.error("Generation failed", {
            description: "No output generated",
          })
        }
      } catch (error) {
        // Handle aborted requests gracefully (user cancelled)
        if (error instanceof Error && error.name === 'AbortError') {
          setNodesWithRef((nds) => nds.map((n) => (n.id === nodeId ? { ...n, data: { ...n.data, status: "idle" } } : n)))
          return // Don't show error toast for cancelled requests
        }

        setNodesWithRef((nds) => nds.map((n) => (n.id === nodeId ? { ...n, data: { ...n.data, status: "error" } } : n)))

        const errorMessage = error instanceof Error ? error.message : "Generation failed"
        const isRateLimitError = errorMessage.includes("Rate limit")
        const isNetworkError = errorMessage.includes("fetch") || errorMessage.includes("NetworkError")

        toast.error(isRateLimitError ? "Rate limit exceeded" : isNetworkError ? "Network error" : "Generation failed", {
          description: errorMessage,
        })
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refs (nodesRef, edgesRef, userIdRef) are stable and intentionally excluded
    [setNodesWithRef, getTargetLanguage],
  )

  const handleUpdateNode = useCallback(
    (nodeId: string, updates: Record<string, unknown>) => {
      setNodesWithRef((nds) => 
        nds.map((n) => (n.id === nodeId ? { ...n, data: { ...n.data, ...updates } } : n))
      )
    },
    [setNodesWithRef],
  )

  // Poll capture status as fallback when stream disconnects
  const pollCaptureStatus = useCallback(async (nodeId: string, captureId: string, userId: string) => {
    const maxAttempts = 60 // 5 minutes at 5s intervals
    let attempts = 0
    
    const poll = async () => {
      try {
        const response = await fetch(`/api/capture-animation/${captureId}?userId=${userId}`)
        if (!response.ok) {
          throw new Error('Failed to fetch capture status')
        }
        
        const data = await response.json()
        
        setNodesWithRef((nds) => nds.map(n => {
          if (n.id !== nodeId) return n
          
          switch (data.status) {
            case 'pending':
            case 'processing':
              return { ...n, data: { ...n.data, status: 'capturing', statusMessage: 'Processing in background...' } }
            case 'completed':
              return { ...n, data: { ...n.data, status: 'complete', videoUrl: data.screenshots?.after, captureId: data.captureId, animationContext: data.animationContext } }
            case 'failed':
              return { ...n, data: { ...n.data, status: 'error', error: data.error } }
            default:
              return n
          }
        }))
        
        // Continue polling if still processing
        if (data.status === 'pending' || data.status === 'processing') {
          attempts++
          if (attempts < maxAttempts) {
            setTimeout(poll, 5000)
          } else {
            setNodesWithRef((nds) => nds.map(n => 
              n.id === nodeId ? { ...n, data: { ...n.data, status: 'error', error: 'Capture timed out' } } : n
            ))
          }
        }
      } catch (error) {
        logger.error('Polling error', { error: error instanceof Error ? error.message : String(error) })
        attempts++
        if (attempts < maxAttempts) {
          setTimeout(poll, 5000)
        }
      }
    }
    
    poll()
  }, [setNodesWithRef])

  // Handle capture node execution with SSE streaming + polling fallback
  const handleCaptureNode = useCallback(async (nodeId: string) => {
    const node = nodesRef.current.find(n => n.id === nodeId)
    if (!node || node.type !== 'captureNode') return

    const { url: rawUrl, selector, duration } = node.data as { url: string; selector?: string; duration: number }
    
    if (!rawUrl) {
      toast.error('URL required', { description: 'Please enter a URL to capture' })
      return
    }

    // Normalize URL by adding https:// if missing (handles race condition with capture-node.tsx)
    const trimmedUrl = rawUrl.trim()
    const url = (trimmedUrl.startsWith('http://') || trimmedUrl.startsWith('https://')) 
      ? trimmedUrl 
      : `https://${trimmedUrl}`

    const userId = userIdRef.current
    if (!userId) {
      toast.error('Authentication required', { description: 'Please sign in to use capture' })
      return
    }

    // Update status to connecting
    setNodesWithRef((nds) => nds.map(n => 
      n.id === nodeId ? { ...n, data: { ...n.data, status: 'connecting', error: undefined } } : n
    ))

    let captureId: string | null = null

    try {
      // Use durable workflow endpoint with SSE streaming
      const response = await fetch('/api/capture-animation/workflow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url,
          selector: selector || undefined,
          duration: duration * 1000, // Convert to ms
          userId,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Capture failed')
      }

      // Read SSE stream from workflow
      const reader = response.body?.getReader()
      if (!reader) throw new Error('No response stream')

      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i]
          if (line.startsWith('event: ')) {
            const eventType = line.slice(7)
            const dataLine = lines[i + 1]
            if (dataLine?.startsWith('data: ')) {
              i++
              try {
                const data = JSON.parse(dataLine.slice(6))
                
                if (data.captureId) {
                  captureId = data.captureId
                }
                
                setNodesWithRef((nds) => nds.map(n => {
                  if (n.id !== nodeId) return n
                  
                  switch (eventType) {
                    case 'status':
                      return { 
                        ...n, 
                        data: { 
                          ...n.data, 
                          status: data.status, 
                          ...(data.liveViewUrl && { liveViewUrl: data.liveViewUrl }), 
                          ...(data.sessionId && { sessionId: data.sessionId }), 
                          ...(data.captureId && { captureId: data.captureId }) 
                        } 
                      }
                    case 'progress':
                      return { 
                        ...n, 
                        data: { 
                          ...n.data, 
                          status: 'capturing', 
                          statusMessage: data.message,
                          progress: data.percent || 0,
                        } 
                      }
                    case 'complete':
                      return { 
                        ...n, 
                        data: { 
                          ...n.data, 
                          status: 'complete', 
                          videoUrl: data.videoUrl, 
                          captureId: data.captureId, 
                          animationContext: data.animationContext 
                        } 
                      }
                    case 'error':
                      return { ...n, data: { ...n.data, status: 'error', error: data.message } }
                    default:
                      return n
                  }
                }))
              } catch {
                // Skip malformed JSON
              }
            }
          }
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Capture failed'
      
      // If we have a captureId, the capture might still be running in the background
      // Fall back to polling instead of showing error immediately
      if (captureId) {
        logger.info('Stream disconnected, falling back to polling', { captureId })
        toast.info('Connection interrupted', { description: 'Checking capture status...' })
        setNodesWithRef((nds) => nds.map(n => 
          n.id === nodeId ? { ...n, data: { ...n.data, status: 'capturing', statusMessage: 'Reconnecting...', captureId } } : n
        ))
        pollCaptureStatus(nodeId, captureId, userId)
        return
      }
      
      // No captureId means failure happened before capture started
      setNodesWithRef((nds) => nds.map(n => 
        n.id === nodeId ? { ...n, data: { ...n.data, status: 'error', error: message } } : n
      ))
      toast.error('Capture failed', { description: message })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refs (nodesRef, userIdRef) are stable and intentionally excluded
  }, [setNodesWithRef, pollCaptureStatus])

  const handleStopCapture = useCallback((nodeId: string) => {
    // Reset node status
    setNodesWithRef((nds) => nds.map(n => 
      n.id === nodeId ? { ...n, data: { ...n.data, status: 'idle', progress: 0 } } : n
    ))
  }, [setNodesWithRef])

  const nodesWithHandlers = useMemo(() => {
    return nodes.map((node) => {
      if (node.type === "promptNode") {
        // Only update if handler is different
        if (node.data.onRun === handleRunNode && node.data.onUpdate === handleUpdateNode) return node
        return {
          ...node,
          data: {
            ...node.data,
            onRun: handleRunNode,
            onUpdate: handleUpdateNode,
          },
        }
      }
      if (node.type === "imageNode") {
        // Only update if handler is different
        if (node.data.onUpdate === handleUpdateNode) return node
        return {
          ...node,
          data: {
            ...node.data,
            onUpdate: handleUpdateNode,
          },
        }
      }
      if (node.type === "textInputNode") {
        // Only update if handler is different
        if (node.data.onValueChange === handleTextInputValueChange) return node
        return {
          ...node,
          data: {
            ...node.data,
            onValueChange: handleTextInputValueChange,
          },
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
            onStop: handleStopCapture,
          },
        }
      }
      return node
    })
  }, [nodes, handleRunNode, handleUpdateNode, handleTextInputValueChange, handleCaptureNode, handleStopCapture])

  return (
    <>
      <ReactFlow
        nodes={nodesWithHandlers}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        defaultEdgeOptions={defaultEdgeOptions}
        fitView
        proOptions={{ hideAttribution: true }}
        onContextMenu={handleContextMenu}
        onClick={() => setContextMenu(null)}
      />

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          flowX={contextMenu.flowPosition.x}
          flowY={contextMenu.flowPosition.y}
          onAddImageNode={contextMenuCallbacks.onAddImageNode}
          onAddImageGenPrompt={contextMenuCallbacks.onAddImageGenPrompt}
          onAddTextGenPrompt={contextMenuCallbacks.onAddTextGenPrompt}
          onAddCodeNode={contextMenuCallbacks.onAddCodeNode}
          onAddTextInputNode={contextMenuCallbacks.onAddTextInputNode}
          onAddStickyNoteNode={contextMenuCallbacks.onAddStickyNoteNode}
          onAddCaptureNode={contextMenuCallbacks.onAddCaptureNode}
        />
      )}

      <div className="absolute bottom-4 left-4 z-10 flex flex-col gap-1 bg-card/90 backdrop-blur-sm rounded-lg border border-border shadow-md p-1">
        <button
          onClick={() => zoomIn()}
          className="w-8 h-8 flex items-center justify-center hover:bg-muted rounded transition-colors"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <button
          onClick={() => zoomOut()}
          className="w-8 h-8 flex items-center justify-center hover:bg-muted rounded transition-colors"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <button
          onClick={() => fitView()}
          className="w-8 h-8 flex items-center justify-center hover:bg-muted rounded transition-colors"
        >
          <Maximize className="w-4 h-4" />
        </button>
      </div>

      <NodeToolbar
        onAddImageNode={toolbarCallbacks.onAddImageNode}
        onAddPromptNode={toolbarCallbacks.onAddPromptNode}
        onAddCodeNode={toolbarCallbacks.onAddCodeNode}
        onAddTextInputNode={toolbarCallbacks.onAddTextInputNode}
        onAddStickyNoteNode={toolbarCallbacks.onAddStickyNoteNode}
        onAddCaptureNode={toolbarCallbacks.onAddCaptureNode}
        onDeleteSelected={toolbarCallbacks.onDeleteSelected}
        hasSelection={false}
      />
    </>
  )
}

export function ToolPageClient({ tool }: { tool: string }) {
  const toolType = tool as ToolWorkflowType

  if (!TOOL_WORKFLOW_CONFIG[toolType] || toolType === "style-fusion") {
    return (
      <div className="h-screen w-screen flex items-center justify-center">
        <p className="text-muted-foreground">Tool not found</p>
      </div>
    )
  }

  return (
    <div className="h-screen w-screen bg-gradient-to-b from-gray-100 to-gray-200 relative">
      <div className="absolute inset-0 bg-grid-plus pointer-events-none" />

      <div className="absolute top-4 left-[20px] right-4 z-20 flex items-center justify-between">
        <Link href="/" className="relative flex-shrink-0">
          <div className="absolute inset-0 -m-4 rounded-full bg-purple-300/40 blur-xl" />
          <div
            className="relative flex flex-shrink-0 items-center gap-2 border border-muted-foreground/20 bg-neutral-900 bg-clip-padding text-white backdrop-blur-md rounded-full px-4 py-1.5 shadow-lg hover:bg-neutral-800 transition-colors cursor-pointer"
            style={{ boxShadow: "inset 0 2px 8px rgba(168, 85, 247, 0.15), 0 10px 15px -3px rgba(0, 0, 0, 0.1)" }}
          >
            <MotifLogo width={45} height={16} />
          </div>
        </Link>

        <ToolsMenu />
      </div>

      <ReactFlowProvider key={toolType}>
        <WorkflowErrorBoundary>
          <ToolCanvasContent tool={toolType} />
        </WorkflowErrorBoundary>
      </ReactFlowProvider>
    </div>
  )
}
