"use client"

import { useEffect, useState, useRef, useCallback } from "react"
import { useRouter } from "next/navigation"
import dynamic from "next/dynamic"
import { Loader2 } from "lucide-react"
import { useAuth } from "@/lib/context/auth-context"
import { createWorkflow } from "@/lib/supabase/workflows"
import { MotifLogo } from "@/components/motif-logo"
import { WorkflowErrorBoundary } from "@/components/workflow/workflow-error-boundary"
import { logger } from "@/lib/logger"
import { toast } from "sonner"
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

export default function Home() {
  const router = useRouter()
  const { user, isLoading: isAuthLoading, isAuthenticated, openAuthModal } = useAuth()
  const [isCreatingWorkflow, setIsCreatingWorkflow] = useState(false)
  const [gridOpacity, setGridOpacity] = useState(1)
  const [initialZoom, setInitialZoom] = useState<number | null>(null)
  const canvasRef = useRef<WorkflowCanvasHandle>(null)
  const hasRedirected = useRef(false)

  // Handle zoom changes for grid opacity
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

  // When authenticated user lands on home, create workflow and redirect
  useEffect(() => {
    if (isAuthLoading || !isAuthenticated || !user || hasRedirected.current) return

    hasRedirected.current = true
    setIsCreatingWorkflow(true)

    async function createAndRedirect() {
      try {
        const workflowId = await createWorkflow(user!.id, "My Workflow")

        if (!workflowId) {
          logger.error('Failed to create workflow - null returned')
          toast.error("Failed to create workflow", {
            description: "Please try again or refresh the page.",
          })
          setIsCreatingWorkflow(false)
          hasRedirected.current = false
          return
        }

        router.replace(`/w/${workflowId}`)
      } catch (err) {
        logger.error('Failed to create workflow', { error: err instanceof Error ? err.message : String(err) })
        toast.error("Failed to create workflow", {
          description: "An unexpected error occurred. Please try again.",
        })
        setIsCreatingWorkflow(false)
        hasRedirected.current = false
      }
    }

    createAndRedirect()
  }, [isAuthLoading, isAuthenticated, user, router])

  // Show loading state while checking auth or creating workflow
  if (isAuthLoading || isCreatingWorkflow) {
    return (
      <div className="min-h-screen relative">
        <div className="absolute inset-0 bg-gradient-to-b from-secondary to-muted" />
        <div className="absolute inset-0 bg-grid-plus" />

        <main className="relative w-full h-screen overflow-hidden flex flex-col items-center justify-center">
          <div className="absolute top-4 left-[20px]">
            <div className="relative flex-shrink-0">
              <div className="absolute inset-0 -m-4 rounded-full bg-glow/40 blur-xl" />
              <div
                className="relative flex flex-shrink-0 items-center gap-2 border border-muted-foreground/20 bg-neutral-900 bg-clip-padding text-primary-foreground backdrop-blur-md rounded-full px-4 py-1.5 shadow-lg"
                style={{ boxShadow: "inset 0 2px 8px rgba(168, 85, 247, 0.15), 0 10px 15px -3px rgba(0, 0, 0, 0.1)" }}
              >
                <MotifLogo width={45} height={16} />
              </div>
            </div>
          </div>

          <div className="flex flex-col items-center gap-4">
            <Loader2 className="w-8 h-8 text-muted-foreground animate-spin" />
            <p className="text-sm text-muted-foreground">
              {isCreatingWorkflow ? "Creating new workflow..." : "Loading..."}
            </p>
          </div>
        </main>
      </div>
    )
  }

  // Not authenticated - show demo canvas with auth modal trigger
  return (
    <div className="min-h-screen relative">
      <div className="absolute inset-0 bg-gradient-to-b from-secondary to-muted" />
      <div className="absolute inset-0 bg-grid-plus transition-opacity duration-150" style={{ opacity: gridOpacity }} />

      <main className="relative w-full h-screen overflow-hidden">
        <div className="absolute top-3 sm:top-4 left-3 sm:left-[20px] right-3 sm:right-4 z-10 flex items-center justify-between">
          {/* Logo pill */}
          <div className="relative flex-shrink-0">
            <div className="absolute inset-0 -m-4 rounded-full bg-glow/40 blur-xl" />
            <div
              className="relative flex flex-shrink-0 items-center gap-2 border border-muted-foreground/20 bg-neutral-900 bg-clip-padding text-primary-foreground backdrop-blur-md rounded-full px-3 sm:px-4 py-1 sm:py-1.5 shadow-lg"
              style={{ boxShadow: "inset 0 2px 8px rgba(168, 85, 247, 0.15), 0 10px 15px -3px rgba(0, 0, 0, 0.1)" }}
            >
              <MotifLogo width={45} height={16} />
            </div>
          </div>

          {/* Sign in button instead of tools menu for unauthenticated users */}
          <button
            onClick={openAuthModal}
            className="relative z-50 flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-primary border border-muted-foreground/20 backdrop-blur-md text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
            style={{ boxShadow: "inset 0 2px 8px rgba(168, 85, 247, 0.15), 0 10px 15px -3px rgba(0, 0, 0, 0.1)" }}
          >
            Sign in
          </button>
        </div>

        <div className="w-full h-full">
          <WorkflowErrorBoundary>
            <WorkflowCanvas 
              ref={canvasRef} 
              router={router} 
              onZoomChange={handleZoomChange} 
              hideControls={false}
              demoMode={true}
            />
          </WorkflowErrorBoundary>
        </div>
      </main>
    </div>
  )
}
