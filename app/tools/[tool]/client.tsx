"use client"

import type React from "react"
import { useEffect, useRef, useCallback, useState } from "react"
import Link from "next/link"
import {
  ReactFlow,
  ReactFlowProvider,
  useNodesState,
  useEdgesState,
  addEdge,
  useReactFlow,
  type Connection,
  type Edge,
  type Node,
} from "@xyflow/react"
import "@xyflow/react/dist/style.css"
import { ZoomIn, ZoomOut, Maximize } from "lucide-react"
import { toast } from "sonner"
import { ImageNode } from "@/components/workflow/image-node"
import { PromptNode } from "@/components/workflow/prompt-node"
import { CodeNode } from "@/components/workflow/code-node"
import { TOOL_WORKFLOW_CONFIG, type ToolWorkflowType } from "@/lib/workflow/tool-workflows"
import { getInputImagesForNode } from "@/lib/workflow/image-utils"
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
  const [nodes, setNodes, onNodesChange] = useNodesState(workflow.nodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(workflow.edges)
  const nodesRef = useRef<Node[]>(workflow.nodes)
  const edgesRef = useRef<Edge[]>(workflow.edges)

  const [contextMenu, setContextMenu] = useState<{
    x: number
    y: number
    flowPosition: { x: number; y: number }
  } | null>(null)

  const handleAddImageNode = useCallback(
    (position?: { x: number; y: number }) => {
      const newNode = createImageNode(position || { x: 100, y: 100 })
      setNodes((nds) => {
        const updated = [...nds, newNode]
        nodesRef.current = updated
        return updated
      })
      setContextMenu(null)
    },
    [setNodes],
  )

  const handleAddPromptNode = useCallback(
    (outputType: "image" | "text", position?: { x: number; y: number }) => {
      const newNode = createPromptNode(position || { x: 100, y: 100 }, outputType)
      setNodes((nds) => {
        const updated = [...nds, newNode]
        nodesRef.current = updated
        return updated
      })
      setContextMenu(null)
    },
    [setNodes],
  )

  const handleAddCodeNode = useCallback(
    (position?: { x: number; y: number }) => {
      const newNode = createCodeNode(position || { x: 100, y: 100 })
      setNodes((nds) => {
        const updated = [...nds, newNode]
        nodesRef.current = updated
        return updated
      })
      setContextMenu(null)
    },
    [setNodes],
  )

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

  useEffect(() => {
    nodesRef.current = nodes
  }, [nodes])

  useEffect(() => {
    edgesRef.current = edges
  }, [edges])

  const onConnect = useCallback(
    (params: Connection) => {
      setEdges((eds) => {
        const newEdges = addEdge({ ...params, type: "curved" }, eds)
        edgesRef.current = newEdges
        return newEdges
      })
    },
    [setEdges],
  )

  const handleRunNode = useCallback(
    async (nodeId: string, prompt: string, model: string) => {
      const inputImages = getInputImagesForNode(nodeId, nodesRef.current, edgesRef.current)

      setNodes((nds) => nds.map((n) => (n.id === nodeId ? { ...n, data: { ...n.data, status: "running" } } : n)))

      try {
        const response = await fetch("/api/generate-image", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt, model, images: inputImages }),
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
          setNodes((nds) => {
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
                  if (n.type === "imageNode" && data.outputImage) {
                    return { ...n, data: { ...n.data, imageUrl: data.outputImage } }
                  }
                  if (n.type === "codeNode" && data.text) {
                    return { ...n, data: { ...n.data, content: data.text } }
                  }
                }
                return n
              })
            }

            nodesRef.current = updatedNodes
            return updatedNodes
          })
        } else {
          setNodes((nds) => nds.map((n) => (n.id === nodeId ? { ...n, data: { ...n.data, status: "error" } } : n)))
          toast.error("Generation failed", {
            description: data.error || "Unknown error occurred",
          })
        }
      } catch (error) {
        setNodes((nds) => nds.map((n) => (n.id === nodeId ? { ...n, data: { ...n.data, status: "error" } } : n)))

        const errorMessage = error instanceof Error ? error.message : "Generation failed"
        const isRateLimitError = errorMessage.includes("Rate limit")
        const isNetworkError = errorMessage.includes("fetch") || errorMessage.includes("NetworkError")

        toast.error(isRateLimitError ? "Rate limit exceeded" : isNetworkError ? "Network error" : "Generation failed", {
          description: errorMessage,
        })
      }
    },
    [setNodes],
  )

  const handleUpdateNode = useCallback(
    (nodeId: string, updates: Record<string, unknown>) => {
      setNodes((nds) => {
        const updatedNodes = nds.map((n) => (n.id === nodeId ? { ...n, data: { ...n.data, ...updates } } : n))
        nodesRef.current = updatedNodes
        return updatedNodes
      })
    },
    [setNodes],
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
