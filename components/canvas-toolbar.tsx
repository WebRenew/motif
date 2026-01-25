"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { useRouter, useParams } from "next/navigation"
import {
  History,
  Heart,
  Plus,
  X,
  Workflow,
} from "lucide-react"
import {
  getRecentWorkflows,
  getFavoriteWorkflows,
  toggleWorkflowFavorite,
  createWorkflow,
} from "@/lib/supabase/workflows"
import { useAuth } from "@/lib/context/auth-context"
import { logger } from "@/lib/logger"
import { toast } from "sonner"
import { TOOL_WORKFLOW_CONFIG, type ToolWorkflowType } from "@/lib/workflow/tool-workflows"
import { KeyframesIcon } from "@/components/icons/keyframes"

type PanelType = "history" | "favorites" | null

interface WorkflowItem {
  id: string
  name: string
  tool_type: string
  updated_at: string
  is_favorite?: boolean
}

function getRelativeTimeString(date: string): string {
  const now = new Date()
  const past = new Date(date)
  const diffInSeconds = Math.floor((now.getTime() - past.getTime()) / 1000)

  if (diffInSeconds < 60) return "just now"
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`
  if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`
  if (diffInSeconds < 2592000) return `${Math.floor(diffInSeconds / 604800)}w ago`
  return `${Math.floor(diffInSeconds / 2592000)}mo ago`
}

function RelativeTime({ updatedAt }: { updatedAt: string }) {
  const [relativeTime, setRelativeTime] = useState<string>("")

  useEffect(() => {
    setRelativeTime(getRelativeTimeString(updatedAt))
  }, [updatedAt])

  if (!relativeTime) return null

  return (
    <span className="text-xs text-muted-foreground tabular-nums">
      {relativeTime}
    </span>
  )
}

function getToolIcon(toolType: string, className = "w-3.5 h-3.5") {
  const config = TOOL_WORKFLOW_CONFIG[toolType as ToolWorkflowType]
  if (!config) {
    return <Workflow className={className} />
  }

  switch (config.icon) {
    case "keyframes":
      return <KeyframesIcon className={className} />
    case "code":
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="16 18 22 12 16 6" />
          <polyline points="8 6 2 12 8 18" />
        </svg>
      )
    case "palette":
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <circle cx="12" cy="12" r="4" />
          <line x1="4.93" y1="4.93" x2="9.17" y2="9.17" />
          <line x1="14.83" y1="14.83" x2="19.07" y2="19.07" />
          <line x1="14.83" y1="9.17" x2="19.07" y2="4.93" />
          <line x1="4.93" y1="19.07" x2="9.17" y2="14.83" />
        </svg>
      )
    case "home":
      return <Workflow className={className} />
    default:
      return <Workflow className={className} />
  }
}

interface CanvasToolbarProps {
  /** Current workflow ID (if viewing an existing workflow) */
  workflowId?: string
  /** Tool type for filtering history (e.g., "animation-capture") */
  toolType?: string
}

export function CanvasToolbar({ workflowId, toolType }: CanvasToolbarProps) {
  const router = useRouter()
  const params = useParams()
  const { user } = useAuth()
  const [activePanel, setActivePanel] = useState<PanelType>(null)
  const [recentWorkflows, setRecentWorkflows] = useState<WorkflowItem[]>([])
  const [favoriteWorkflows, setFavoriteWorkflows] = useState<WorkflowItem[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isCreating, setIsCreating] = useState(false)

  // Get current workflow ID from props or params
  const currentWorkflowId = workflowId || (params.workflowId as string | undefined)
  const currentToolType = toolType || (params.tool as string | undefined)

  // Fetch when panel opens with race condition protection
  useEffect(() => {
    if (!activePanel || !user) return

    let cancelled = false

    const fetch = async () => {
      setIsLoading(true)
      try {
        const [recent, favorites] = await Promise.all([
          getRecentWorkflows(user.id, { limit: 20 }),
          getFavoriteWorkflows(user.id, { limit: 20 }),
        ])
        if (!cancelled) {
          setRecentWorkflows(recent)
          setFavoriteWorkflows(favorites)
        }
      } catch (error) {
        if (!cancelled) {
          logger.error("Failed to fetch workflows", { error: error instanceof Error ? error.message : String(error) })
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    }

    fetch()
    return () => { cancelled = true }
  }, [activePanel, user])

  const handleTogglePanel = useCallback((panel: PanelType) => {
    setActivePanel((prev) => (prev === panel ? null : panel))
  }, [])

  const handleClosePanel = useCallback(() => {
    setActivePanel(null)
  }, [])

  const handleNewSession = useCallback(async () => {
    if (!user || isCreating) return

    setIsCreating(true)
    try {
      const effectiveToolType = currentToolType || "style-fusion"
      const workflowName = currentToolType
        ? TOOL_WORKFLOW_CONFIG[currentToolType as ToolWorkflowType]?.name || "New Workflow"
        : "My Workflow"

      const newWorkflowId = await createWorkflow(user.id, workflowName, effectiveToolType)

      if (!newWorkflowId) {
        toast.error("Failed to create workflow")
        return
      }

      // Navigate to the new workflow
      if (currentToolType) {
        router.push(`/tools/${currentToolType}/${newWorkflowId}`)
      } else {
        router.push(`/w/${newWorkflowId}`)
      }

      handleClosePanel()
    } catch (error) {
      logger.error("Failed to create workflow", { error: error instanceof Error ? error.message : String(error) })
      toast.error("Failed to create workflow")
    } finally {
      setIsCreating(false)
    }
  }, [user, isCreating, currentToolType, router, handleClosePanel])

  const handleSelectWorkflow = useCallback(
    (workflow: WorkflowItem) => {
      // Navigate based on tool type
      if (workflow.tool_type === "style-fusion" || !workflow.tool_type) {
        router.push(`/w/${workflow.id}`)
      } else {
        router.push(`/tools/${workflow.tool_type}/${workflow.id}`)
      }
      handleClosePanel()
    },
    [router, handleClosePanel],
  )

  const handleToggleFavorite = useCallback(
    async (e: React.MouseEvent, workflow: WorkflowItem) => {
      e.stopPropagation()
      const newValue = !workflow.is_favorite

      // Optimistic update for instant feedback
      setRecentWorkflows((prev) =>
        prev.map((w) => (w.id === workflow.id ? { ...w, is_favorite: newValue } : w)),
      )
      if (newValue) {
        setFavoriteWorkflows((prev) => [{ ...workflow, is_favorite: true }, ...prev])
      } else {
        setFavoriteWorkflows((prev) => prev.filter((w) => w.id !== workflow.id))
      }

      const success = await toggleWorkflowFavorite(workflow.id, newValue)

      if (!success) {
        // Rollback on failure
        setRecentWorkflows((prev) =>
          prev.map((w) => (w.id === workflow.id ? { ...w, is_favorite: !newValue } : w)),
        )
        if (newValue) {
          setFavoriteWorkflows((prev) => prev.filter((w) => w.id !== workflow.id))
        } else {
          setFavoriteWorkflows((prev) => [{ ...workflow, is_favorite: true }, ...prev])
        }
        toast.error("Failed to update favorite")
      }
    },
    [],
  )

  // Filter history by current tool type if specified
  const filteredHistory = useMemo(() => {
    if (!currentToolType) return recentWorkflows
    return recentWorkflows.filter((w) => w.tool_type === currentToolType)
  }, [recentWorkflows, currentToolType])

  // Don't show if not authenticated
  if (!user) return null

  return (
    <>
      {/* Floating Toolbar */}
      <div className="fixed left-4 top-1/2 -translate-y-1/2 z-40 flex flex-col gap-1">
        {/* Toolbar Container */}
        <div
          className="flex flex-col gap-1 p-1.5 rounded-xl border border-border/50 bg-background/80 backdrop-blur-md shadow-lg"
          style={{ boxShadow: "0 4px 24px rgba(0,0,0,0.12), inset 0 1px 0 rgba(255,255,255,0.05)" }}
        >
          {/* New Session */}
          <button
            onClick={handleNewSession}
            disabled={isCreating}
            className="flex items-center justify-center w-9 h-9 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors disabled:opacity-50"
            title="New session"
          >
            {isCreating ? (
              <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
            ) : (
              <Plus className="w-4 h-4" />
            )}
          </button>

          {/* Divider */}
          <div className="h-px bg-border/50 mx-1" />

          {/* History */}
          <button
            onClick={() => handleTogglePanel("history")}
            className={`flex items-center justify-center w-9 h-9 rounded-lg transition-colors ${
              activePanel === "history"
                ? "bg-accent text-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-accent"
            }`}
            title="Session history"
          >
            <History className="w-4 h-4" />
          </button>

          {/* Favorites */}
          <button
            onClick={() => handleTogglePanel("favorites")}
            className={`flex items-center justify-center w-9 h-9 rounded-lg transition-colors ${
              activePanel === "favorites"
                ? "bg-accent text-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-accent"
            }`}
            title="Favorites"
          >
            <Heart
              className={`w-4 h-4 ${
                activePanel === "favorites" || favoriteWorkflows.length > 0 ? "fill-current" : ""
              }`}
            />
          </button>
        </div>
      </div>

      {/* Slide-out Panel */}
      {activePanel && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-30" onClick={handleClosePanel} />

          {/* Panel */}
          <div
            className="fixed left-16 top-1/2 -translate-y-1/2 z-40 w-72 max-h-[70vh] rounded-xl border border-border/50 bg-background/95 backdrop-blur-md shadow-xl overflow-hidden"
            style={{ boxShadow: "0 8px 32px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.05)" }}
          >
            {/* Panel Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
              <h3 className="text-sm font-medium text-foreground">
                {activePanel === "history" ? "History" : "Favorites"}
              </h3>
              <button
                onClick={handleClosePanel}
                className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Panel Content */}
            <div className="overflow-y-auto max-h-[calc(70vh-56px)]">
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="w-5 h-5 border-2 border-node-selected border-t-transparent rounded-full animate-spin" />
                </div>
              ) : activePanel === "history" ? (
                filteredHistory.length > 0 ? (
                  <div className="p-2">
                    {filteredHistory.map((workflow) => (
                      <button
                        key={workflow.id}
                        onClick={() => handleSelectWorkflow(workflow)}
                        className={`group w-full flex items-start gap-3 p-2.5 rounded-lg text-left transition-colors hover:bg-accent ${
                          workflow.id === currentWorkflowId ? "bg-accent" : ""
                        }`}
                      >
                        <div className="flex-shrink-0 w-7 h-7 rounded-md bg-muted flex items-center justify-center text-muted-foreground">
                          {getToolIcon(workflow.tool_type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-foreground truncate">
                              {workflow.name}
                            </span>
                            {workflow.id === currentWorkflowId && (
                              <span className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-node-selected" />
                            )}
                          </div>
                          <RelativeTime updatedAt={workflow.updated_at} />
                        </div>
                        <button
                          onClick={(e) => handleToggleFavorite(e, workflow)}
                          className={`flex-shrink-0 p-1 rounded-md transition-colors ${
                            workflow.is_favorite
                              ? "text-node-selected"
                              : "text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-foreground"
                          }`}
                          title={workflow.is_favorite ? "Remove from favorites" : "Add to favorites"}
                        >
                          <Heart className={`w-3.5 h-3.5 ${workflow.is_favorite ? "fill-current" : ""}`} />
                        </button>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
                    <History className="w-8 h-8 text-muted-foreground/50 mb-2" />
                    <p className="text-sm text-muted-foreground">No session history yet</p>
                    <p className="text-xs text-muted-foreground/70 mt-1">
                      Your workflows will appear here
                    </p>
                  </div>
                )
              ) : favoriteWorkflows.length > 0 ? (
                <div className="p-2">
                  {favoriteWorkflows.map((workflow) => (
                    <button
                      key={workflow.id}
                      onClick={() => handleSelectWorkflow(workflow)}
                      className={`group w-full flex items-start gap-3 p-2.5 rounded-lg text-left transition-colors hover:bg-accent ${
                        workflow.id === currentWorkflowId ? "bg-accent" : ""
                      }`}
                    >
                      <div className="flex-shrink-0 w-7 h-7 rounded-md bg-muted flex items-center justify-center text-muted-foreground">
                        {getToolIcon(workflow.tool_type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-foreground truncate">
                            {workflow.name}
                          </span>
                          {workflow.id === currentWorkflowId && (
                            <span className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-node-selected" />
                          )}
                        </div>
                        <RelativeTime updatedAt={workflow.updated_at} />
                      </div>
                      <button
                        onClick={(e) => handleToggleFavorite(e, { ...workflow, is_favorite: true })}
                        className="flex-shrink-0 p-1 rounded-md text-node-selected transition-colors hover:text-destructive"
                        title="Remove from favorites"
                      >
                        <Heart className="w-3.5 h-3.5 fill-current" />
                      </button>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
                  <Heart className="w-8 h-8 text-muted-foreground/50 mb-2" />
                  <p className="text-sm text-muted-foreground">No favorites yet</p>
                  <p className="text-xs text-muted-foreground/70 mt-1">
                    Click the heart icon on a session to save it
                  </p>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </>
  )
}
