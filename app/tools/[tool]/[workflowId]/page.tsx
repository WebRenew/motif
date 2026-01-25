"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useParams, useRouter } from "next/navigation"
import dynamic from "next/dynamic"
import { ToolsMenu } from "@/components/tools-menu"
import { Breadcrumb } from "@/components/breadcrumb"
import { WorkflowErrorBoundary } from "@/components/workflow/workflow-error-boundary"
import { Loader2 } from "lucide-react"
import { TOOL_WORKFLOW_CONFIG, type ToolWorkflowType } from "@/lib/workflow/tool-workflows"
import type { WorkflowCanvasHandle } from "@/components/workflow/workflow-canvas"
import { KeyframesIcon } from "@/components/icons/keyframes"

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

  // Get the icon component for this tool
  const getToolIcon = (iconName: string) => {
    switch (iconName) {
      case "keyframes":
        return <KeyframesIcon className="w-4 h-4" />
      case "code":
        return (
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="16 18 22 12 16 6" />
            <polyline points="8 6 2 12 8 18" />
          </svg>
        )
      case "palette":
        return (
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <circle cx="12" cy="12" r="4" />
            <line x1="4.93" y1="4.93" x2="9.17" y2="9.17" />
            <line x1="14.83" y1="14.83" x2="19.07" y2="19.07" />
            <line x1="14.83" y1="9.17" x2="19.07" y2="4.93" />
            <line x1="4.93" y1="19.07" x2="9.17" y2="14.83" />
          </svg>
        )
      case "type":
        return (
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="4 7 4 4 20 4 20 7" />
            <line x1="9" y1="20" x2="15" y2="20" />
            <line x1="12" y1="4" x2="12" y2="20" />
          </svg>
        )
      case "message":
        return (
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        )
      case "sparkles":
        return (
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
          </svg>
        )
      default:
        return null
    }
  }

  if (!config || toolType === "style-fusion") {
    return null
  }

  return (
    <div className="min-h-screen relative">
      <div className="absolute inset-0 bg-gradient-to-b from-secondary to-muted" />
      <div className="absolute inset-0 bg-grid-plus transition-opacity duration-150" style={{ opacity: gridOpacity }} />

      <main className="relative w-full h-screen overflow-hidden">
        <div className="absolute top-3 sm:top-4 left-3 sm:left-[20px] right-3 sm:right-4 z-10 flex items-center justify-between">
          {/* Breadcrumb navigation */}
          <Breadcrumb
            icon={getToolIcon(config.icon)}
            label={config.name}
          />

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
