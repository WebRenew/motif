"use client"

import { useEffect, useState, useRef } from "react"
import { useRouter, useParams } from "next/navigation"
import { Loader2 } from "lucide-react"
import { createWorkflowWithTemplate } from "@/lib/supabase/workflows"
import { TOOL_WORKFLOW_CONFIG, type ToolWorkflowType } from "@/lib/workflow/tool-workflows"
import { MotifLogo } from "@/components/motif-logo"
import { useAuth } from "@/lib/context/auth-context"
import { logger } from "@/lib/logger"

export default function ToolRedirectPage() {
  const router = useRouter()
  const params = useParams()
  const tool = params.tool as string
  const { user, isLoading: isAuthLoading, isAuthenticated } = useAuth()
  const [error, setError] = useState<string | null>(null)
  const hasInitialized = useRef(false)

  // Redirect unauthenticated users to home
  useEffect(() => {
    if (!isAuthLoading && !isAuthenticated) {
      router.push("/")
    }
  }, [isAuthLoading, isAuthenticated, router])

  useEffect(() => {
    // Wait for auth to resolve and ensure user is authenticated
    if (isAuthLoading || !isAuthenticated || !user) return
    
    // Prevent double-initialization in React 18 Strict Mode
    if (hasInitialized.current) return
    hasInitialized.current = true

    const toolType = tool as ToolWorkflowType
    const config = TOOL_WORKFLOW_CONFIG[toolType]

    // Validate tool exists
    if (!config || toolType === "style-fusion") {
      setError("Tool not found")
      return
    }

    // Track if component unmounts during async operation
    let isMounted = true

    async function createAndRedirect() {
      try {
        const userId = user!.id

        // Create workflow with tool template
        const template = config.createWorkflow()
        const workflowId = await createWorkflowWithTemplate(
          userId,
          config.name,
          template.nodes,
          template.edges
        )

        if (!isMounted) return
        if (!workflowId) {
          setError("Could not create workflow. Please refresh to try again.")
          return
        }

        // Redirect to the tool with workflow ID
        router.replace(`/tools/${tool}/${workflowId}`)
      } catch (err) {
        if (!isMounted) return
        logger.error('Failed to create tool workflow', { error: err instanceof Error ? err.message : String(err), tool })
        setError("An error occurred. Please refresh to try again.")
      }
    }

    createAndRedirect()

    return () => {
      isMounted = false
    }
  }, [router, tool, isAuthLoading, isAuthenticated, user])

  // Show loading state while checking auth or if not authenticated (redirecting)
  if (isAuthLoading || !isAuthenticated) {
    return (
      <div className="min-h-screen relative">
        <div className="absolute inset-0 bg-gradient-to-b from-secondary to-muted" />
        <div className="absolute inset-0 bg-grid-plus" />
        <main className="relative w-full h-screen overflow-hidden flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-muted-foreground animate-spin" />
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen relative">
      <div className="absolute inset-0 bg-gradient-to-b from-secondary to-muted" />
      <div className="absolute inset-0 bg-grid-plus" />

      <main className="relative w-full h-screen overflow-hidden flex flex-col items-center justify-center">
        <div className="absolute top-4 left-[20px]">
          <div className="relative flex-shrink-0">
            <div className="absolute inset-0 -m-4 rounded-full bg-glow/40 blur-xl" />
            <div
              className="relative flex flex-shrink-0 items-center gap-2 border border-muted-foreground/20 bg-neutral-900 bg-clip-padding text-primary-foreground backdrop-blur-md rounded-full px-4 py-1.5 shadow-lg ring-2 ring-background"
              style={{ boxShadow: "inset 0 2px 8px rgba(168, 85, 247, 0.15), 0 10px 15px -3px rgba(0, 0, 0, 0.1)" }}
            >
              <MotifLogo width={45} height={16} />
            </div>
          </div>
        </div>

        {error ? (
          <div className="text-center">
            <p className="text-lg text-destructive mb-4">{error}</p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
              >
                Try Again
              </button>
              <button
                onClick={() => router.push("/")}
                className="px-4 py-2 bg-muted text-muted-foreground rounded-lg hover:bg-muted/80 transition-colors"
              >
                Go Home
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="w-8 h-8 text-muted-foreground animate-spin" />
            <p className="text-sm text-muted-foreground">Setting up {TOOL_WORKFLOW_CONFIG[tool as ToolWorkflowType]?.name || 'tool'}...</p>
          </div>
        )}
      </main>
    </div>
  )
}
