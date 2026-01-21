"use client"

import type React from "react"
import { useRef, useCallback, useState, useEffect } from "react"
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
import { TOOL_WORKFLOW_CONFIG, type ToolWorkflowType } from "@/lib/workflow/tool-workflows"
import { getAllInputsFromNodes } from "@/lib/workflow/image-utils"
import { ToolsMenu } from "@/components/tools-menu"
import { NodeToolbar } from "@/components/workflow/node-toolbar"
import { ContextMenu } from "@/components/workflow/context-menu"
import { createImageNode, createPromptNode, createCodeNode } from "@/lib/workflow/node-factories"
import { MotifLogo } from "@/components/motif-logo"

const nodeTypes = {
  imageNode: ImageNode,
  promptNode: PromptNode,
  codeNode: CodeNode,
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

function ToolCanvasContent({ tool }: { tool: ToolWorkflowType }) {
  const config = TOOL_WORKFLOW_CONFIG[tool]
  const { fitView, zoomIn, zoomOut } = useReactFlow()

  const [workflow] = useState(() => config.createWorkflow())
  const [nodes, setNodes] = useState<Node[]>(workflow.nodes)
  const [edges, setEdges] = useState<Edge[]>(workflow.edges)
  const nodesRef = useRef<Node[]>(workflow.nodes)
  const edgesRef = useRef<Edge[]>(workflow.edges)
  const abortControllerRef = useRef<AbortController | null>(null)

  const [contextMenu, setContextMenu] = useState<{
    x: number
    y: number
    flowPosition: { x: number; y: number }
  } | null>(null)

  // Wrapper that updates both state and ref atomically
  const setNodesWithRef = useCallback(
    (updater: (nds: Node[]) => Node[]) => {
      setNodes((nds) => {
        const updated = updater(nds)
        nodesRef.current = updated
        return updated
      })
    },
    [],
  )

  const setEdgesWithRef = useCallback(
    (updater: (eds: Edge[]) => Edge[]) => {
      setEdges((eds) => {
        const updated = updater(eds)
        edgesRef.current = updated
        return updated
      })
    },
    [],
  )

  // Handle ReactFlow node changes and keep ref in sync
  const onNodesChange = useCallback((changes: NodeChange[]) => {
    setNodes((nds) => {
      const updated = applyNodeChanges(changes, nds)
      nodesRef.current = updated
      return updated
    })
  }, [])

  // Handle ReactFlow edge changes and keep ref in sync
  const onEdgesChange = useCallback((changes: EdgeChange[]) => {
    setEdges((eds) => {
      const updated = applyEdgeChanges(changes, eds)
      edgesRef.current = updated
      return updated
    })
  }, [])

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
  }, [])

  const handleRunNode = useCallback(
    async (nodeId: string, prompt: string, model: string) => {
      // Collect all inputs (images and text from code nodes)
      const allInputs = getAllInputsFromNodes(nodeId, nodesRef.current, edgesRef.current)
      
      // Get target language from connected code output node
      const targetLanguage = getTargetLanguage(nodeId)

      setNodesWithRef((nds) => nds.map((n) => (n.id === nodeId ? { ...n, data: { ...n.data, status: "running" } } : n)))

      try {
        // Abort any previous request and create new AbortController
        if (abortControllerRef.current) {
          abortControllerRef.current.abort()
        }
        abortControllerRef.current = new AbortController()
        const signal = abortControllerRef.current.signal

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

        if (data.success) {
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
                if (n.id === outputNodeId) {
                  if (n.type === "imageNode" && data.outputImage?.url) {
                    return { ...n, data: { ...n.data, imageUrl: data.outputImage.url } }
                  }
                  if (n.type === "codeNode" && data.text) {
                    return { ...n, data: { ...n.data, content: data.text } }
                  }
                }
                return n
              })
            }

            return updatedNodes
          })
        } else {
          setNodesWithRef((nds) => nds.map((n) => (n.id === nodeId ? { ...n, data: { ...n.data, status: "error" } } : n)))
          toast.error("Generation failed", {
            description: data.error || "Unknown error occurred",
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

  const nodesWithHandlers = nodes.map((node) => {
    if (node.type === "promptNode") {
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
      return {
        ...node,
        data: {
          ...node.data,
          onUpdate: handleUpdateNode,
        },
      }
    }
    return node
  })

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
        defaultEdgeOptions={{ type: "curved", style: { stroke: "#94a3b8", strokeWidth: 2 } }}
        fitView
        proOptions={{ hideAttribution: true }}
        onContextMenu={handleContextMenu}
        onClick={() => setContextMenu(null)}
      />

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onAddImageNode={() => handleAddImageNode(contextMenu.flowPosition)}
          onAddImageGenPrompt={() => handleAddPromptNode("image", contextMenu.flowPosition)}
          onAddTextGenPrompt={() => handleAddPromptNode("text", contextMenu.flowPosition)}
          onAddCodeNode={() => handleAddCodeNode(contextMenu.flowPosition)}
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
        onAddImageNode={() => handleAddImageNode()}
        onAddPromptNode={handleAddPromptNode}
        onAddCodeNode={() => handleAddCodeNode()}
        onDeleteSelected={() => {}}
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
        <ToolCanvasContent tool={toolType} />
      </ReactFlowProvider>
    </div>
  )
}
