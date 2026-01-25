"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import dynamic from "next/dynamic"
import { ToolsMenu } from "@/components/tools-menu"
import { MotifLogo } from "@/components/motif-logo"
import { WorkflowErrorBoundary } from "@/components/workflow/workflow-error-boundary"
import { Loader2 } from "lucide-react"
import { TOOL_WORKFLOW_CONFIG, type ToolWorkflowType } from "@/lib/workflow/tool-workflows"
import type { WorkflowCanvasHandle } from "@/components/workflow/workflow-canvas"

// Dynamic import for heavy WorkflowCanvas component (~300KB React Flow)
const WorkflowCanvas = dynamic(
  () => import("@/components/workflow/workflow-canvas").then(mod => mod.WorkflowCanvas),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-muted-foreground animate-spin" />
      </div>
    ),
  }
)

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default function ToolWorkflowPage() {
  const params = useParams()
  const router = useRouter()
  const tool = params.tool as string
  const workflowId = params.workflowId as string

  const [isLoading, setIsLoading] = useState(true)
  const [gridOpacity, setGridOpacity] = useState(1)
  const [initialZoom, setInitialZoom] = useState<number | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const canvasRef = useRef<WorkflowCanvasHandle>(null)

  const toolType = tool as ToolWorkflowType
  const config = TOOL_WORKFLOW_CONFIG[toolType]

  // Validate tool and workflowId
  useEffect(() => {
    if (!config || toolType === "style-fusion") {
      router.push("/")
      return
    }

    if (!workflowId || typeof workflowId !== "string" || !UUID_REGEX.test(workflowId)) {
      router.push(`/tools/${tool}`)
      return
    }
  }, [config, toolType, workflowId, router, tool])

  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 300)
    return () => clearTimeout(timer)
  }, [])

  const handleZoomChange = useCallback(
    (zoom: number) => {
      if (initialZoom === null) {
        setInitialZoom(zoom)
        return
      }

      const zoomRatio = zoom / initialZoom

      if (zoomRatio > 1) {
        const opacity = Math.max(0, 1 - (zoomRatio - 1) * 2)
        setGridOpacity(opacity)
      } else {
        const targetOpacity = Math.min(1, 1 - (1 - zoomRatio) * 0.5)
        setGridOpacity(targetOpacity)
      }
    },
    [initialZoom],
  )

  if (!config || toolType === "style-fusion") {
    return null
  }

  return (
    <div className="min-h-screen relative">
      <div className="absolute inset-0 bg-gradient-to-b from-secondary to-muted" />
      <div className="absolute inset-0 bg-grid-plus transition-opacity duration-150" style={{ opacity: gridOpacity }} />

      <main className="relative w-full h-screen overflow-hidden">
        <div className="absolute top-3 sm:top-4 left-3 sm:left-[20px] right-3 sm:right-4 z-10 flex items-center justify-between">
          {/* Logo pill with tool name */}
          <Link href="/" className="relative flex-shrink-0">
            <div className="absolute inset-0 -m-4 rounded-full bg-glow/40 blur-xl" />
            <div
              className="relative flex flex-shrink-0 items-center gap-2 border border-muted-foreground/20 bg-neutral-900 bg-clip-padding text-primary-foreground backdrop-blur-md rounded-full px-3 sm:px-4 py-1 sm:py-1.5 shadow-lg hover:bg-neutral-800 transition-colors"
              style={{ boxShadow: "inset 0 2px 8px rgba(168, 85, 247, 0.15), 0 10px 15px -3px rgba(0, 0, 0, 0.1)" }}
            >
              <MotifLogo width={45} height={16} />
              <span className="text-xs text-muted-foreground/70 hidden sm:inline">/ {config.name}</span>
            </div>
          </Link>

          <ToolsMenu onOpenChange={setMenuOpen} canvasRef={canvasRef} />
        </div>

        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center z-20">
            <Loader2 className="w-8 h-8 text-muted-foreground animate-spin" />
          </div>
        )}

        <div className={`w-full h-full transition-opacity duration-300 ${isLoading ? "opacity-0" : "opacity-100"}`}>
          <WorkflowErrorBoundary>
            <WorkflowCanvas ref={canvasRef} workflowId={workflowId} router={router} onZoomChange={handleZoomChange} hideControls={menuOpen} />
          </WorkflowErrorBoundary>
        </div>
      </main>
    </div>
  )
}
