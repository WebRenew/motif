"use client"

import type React from "react"
import { ToolPageClient } from "./client"

import { useEffect, useRef, useCallback } from "react"
import { useRouter } from "next/navigation"
import {
  ReactFlow,
  useNodesState,
  useEdgesState,
  addEdge,
  type Connection,
  type Node,
  type Edge,
  useReactFlow,
} from "@xyflow/react"
import "@xyflow/react/dist/style.css"

import { ArrowLeft, ZoomIn, ZoomOut, Maximize } from "lucide-react"
import { ImageNode } from "@/components/workflow/image-node"
import { PromptNode } from "@/components/workflow/prompt-node"
import { CodeNode } from "@/components/workflow/code-node"
import { TOOL_WORKFLOW_CONFIG, type ToolWorkflowType } from "@/lib/workflow/tool-workflows"
import { getInputImagesForNode } from "@/lib/workflow/image-utils"

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
  const router = useRouter()
  const config = TOOL_WORKFLOW_CONFIG[tool]
  const { fitView, zoomIn, zoomOut } = useReactFlow()

  const initialWorkflow = config.createWorkflow()
  const [nodes, setNodes, onNodesChange] = useNodesState(initialWorkflow.nodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialWorkflow.edges)
  const nodesRef = useRef<Node[]>(initialWorkflow.nodes)
  const edgesRef = useRef<Edge[]>(initialWorkflow.edges)

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

        if (data.success) {
          setNodes((nds) => {
            const updatedNodes = nds.map((n) => {
              if (n.id === nodeId) {
                return { ...n, data: { ...n.data, status: "complete" } }
              }
              return n
            })

            // Find output node connected to this prompt
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
        }
      } catch {
        setNodes((nds) => nds.map((n) => (n.id === nodeId ? { ...n, data: { ...n.data, status: "error" } } : n)))
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
    <div className="h-screen w-screen bg-gradient-to-b from-gray-100 to-gray-200 relative">
      {/* Background grid */}
      <div className="absolute inset-0 bg-grid-plus pointer-events-none" />

      {/* Header */}
      <div className="fixed top-4 left-[20px] z-20 flex items-center gap-3">
        <button
          onClick={() => router.push("/")}
          className="flex items-center justify-center w-9 h-9 rounded-xl bg-card border border-border hover:bg-muted transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div
          className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-black border border-gray-700/50 backdrop-blur-md"
          style={{ boxShadow: "inset 0 2px 8px rgba(168, 85, 247, 0.15), 0 10px 15px -3px rgba(0, 0, 0, 0.1)" }}
        >
          <span className="text-sm font-serif font-medium italic text-white" style={{ letterSpacing: "-0.02em" }}>
            {config.name}
          </span>
        </div>
      </div>

      {/* Canvas */}
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
      />

      {/* Zoom controls */}
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

      {/* Hints */}
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-10 flex items-center gap-4 text-muted-foreground/50">
        <span className="text-[10px] font-mono">Scroll to zoom</span>
        <span className="text-[10px] font-mono">·</span>
        <span className="text-[10px] font-mono">Drag to pan</span>
      </div>
    </div>
  )
}

export default async function ToolPage({ params }: { params: Promise<{ tool: string }> }) {
  const { tool } = await params
  return <ToolPageClient tool={tool} />
}
