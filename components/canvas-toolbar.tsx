"use client"

import { useState, useEffect, useCallback, useMemo, useRef, type RefObject } from "react"
import { useRouter, useParams } from "next/navigation"
import {
  History,
  Heart,
  Plus,
  X,
  Workflow,
  Pencil,
  Check,
  Search,
  Trash2,
  Download,
  FileText,
  Copy,
  LayoutTemplate,
} from "lucide-react"
import {
  getRecentWorkflows,
  getFavoriteWorkflows,
  toggleWorkflowFavorite,
  createWorkflow,
  createWorkflowWithTemplate,
  loadWorkflow,
  renameWorkflow,
  deleteWorkflow,
} from "@/lib/supabase/workflows"
import { useAuth } from "@/lib/context/auth-context"
import { logger } from "@/lib/logger"
import { toast } from "sonner"
import { TOOL_WORKFLOW_CONFIG, type ToolWorkflowType } from "@/lib/workflow/tool-workflows"
import { KeyframesIcon } from "@/components/icons/keyframes"
import { DownloadAssetsPanel } from "@/components/download-assets-panel"
import type { WorkflowCanvasHandle } from "@/components/workflow/workflow-canvas"

type PanelType = "history" | "favorites" | "download" | null

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

/** Inline edit input for workflow names */
function InlineEdit({
  value,
  onSave,
  onCancel,
}: {
  value: string
  onSave: (newValue: string) => void
  onCancel: () => void
}) {
  const [editValue, setEditValue] = useState(value)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
    inputRef.current?.select()
  }, [])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault()
      const trimmed = editValue.trim()
      if (trimmed && trimmed !== value) {
        onSave(trimmed)
      } else {
        onCancel()
      }
    } else if (e.key === "Escape") {
      onCancel()
    }
  }

  const handleBlur = () => {
    const trimmed = editValue.trim()
    if (trimmed && trimmed !== value) {
      onSave(trimmed)
    } else {
      onCancel()
    }
  }

  return (
    <div className="flex items-center gap-1 flex-1 min-w-0">
      <input
        ref={inputRef}
        type="text"
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        className="flex-1 min-w-0 text-sm font-medium bg-background border border-border rounded px-1.5 py-0.5 text-foreground focus:outline-none focus:ring-1 focus:ring-node-selected"
        onClick={(e) => e.stopPropagation()}
      />
      <button
        onClick={(e) => {
          e.stopPropagation()
          const trimmed = editValue.trim()
          if (trimmed && trimmed !== value) {
            onSave(trimmed)
          } else {
            onCancel()
          }
        }}
        className="p-0.5 rounded text-muted-foreground hover:text-foreground"
      >
        <Check className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}

interface CanvasToolbarProps {
  /** Current workflow ID (if viewing an existing workflow) */
  workflowId?: string
  /** Tool type for filtering history (e.g., "animation-capture") */
  toolType?: string
  /** Reference to the workflow canvas for accessing nodes */
  canvasRef?: RefObject<WorkflowCanvasHandle | null>
}

export function CanvasToolbar({ workflowId, toolType, canvasRef }: CanvasToolbarProps) {
  const router = useRouter()
  const params = useParams()
  const { user } = useAuth()
  const [activePanel, setActivePanel] = useState<PanelType>(null)
  const [recentWorkflows, setRecentWorkflows] = useState<WorkflowItem[]>([])
  const [favoriteWorkflows, setFavoriteWorkflows] = useState<WorkflowItem[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [showNewMenu, setShowNewMenu] = useState(false)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const newMenuRef = useRef<HTMLDivElement>(null)

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
          getRecentWorkflows(user.id, { limit: 10 }),
          getFavoriteWorkflows(user.id, { limit: 10 }),
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

  // Focus search when panel opens
  useEffect(() => {
    if (activePanel && activePanel !== "download") {
      setSearchQuery("")
      // Small delay to ensure panel is rendered
      setTimeout(() => searchInputRef.current?.focus(), 100)
    }
  }, [activePanel])

  // Close new menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (newMenuRef.current && !newMenuRef.current.contains(e.target as Node)) {
        setShowNewMenu(false)
      }
    }
    if (showNewMenu) {
      document.addEventListener("mousedown", handleClickOutside)
    }
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [showNewMenu])

  const handleTogglePanel = useCallback((panel: PanelType) => {
    setActivePanel((prev) => (prev === panel ? null : panel))
    setEditingId(null)
    setSearchQuery("")
  }, [])

  const handleClosePanel = useCallback(() => {
    setActivePanel(null)
    setEditingId(null)
    setSearchQuery("")
  }, [])

  // New workflow from template (default nodes)
  const handleNewFromTemplate = useCallback(async () => {
    if (!user || isCreating) return

    setIsCreating(true)
    setShowNewMenu(false)
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

  // New blank workflow (no nodes)
  const handleNewBlank = useCallback(async () => {
    if (!user || isCreating) return

    setIsCreating(true)
    setShowNewMenu(false)
    try {
      const effectiveToolType = currentToolType || "style-fusion"

      // Create workflow with empty nodes/edges
      const newWorkflowId = await createWorkflowWithTemplate(
        user.id,
        "Blank Workflow",
        [],
        [],
        effectiveToolType
      )

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
      logger.error("Failed to create blank workflow", { error: error instanceof Error ? error.message : String(error) })
      toast.error("Failed to create workflow")
    } finally {
      setIsCreating(false)
    }
  }, [user, isCreating, currentToolType, router, handleClosePanel])

  // Duplicate current workflow
  const handleDuplicateCurrent = useCallback(async () => {
    if (!user || isCreating || !currentWorkflowId) return

    setIsCreating(true)
    setShowNewMenu(false)
    try {
      // Load current workflow data
      const workflowData = await loadWorkflow(currentWorkflowId)
      
      if (!workflowData) {
        toast.error("Failed to load current workflow")
        return
      }

      const effectiveToolType = workflowData.tool_type || currentToolType || "style-fusion"

      // Create new workflow with copied nodes/edges
      const newWorkflowId = await createWorkflowWithTemplate(
        user.id,
        `${workflowData.name || "Workflow"} (copy)`,
        workflowData.nodes,
        workflowData.edges,
        effectiveToolType
      )

      if (!newWorkflowId) {
        toast.error("Failed to duplicate workflow")
        return
      }

      // Navigate to the new workflow
      if (effectiveToolType === "style-fusion" || !effectiveToolType) {
        router.push(`/w/${newWorkflowId}`)
      } else {
        router.push(`/tools/${effectiveToolType}/${newWorkflowId}`)
      }

      handleClosePanel()
      toast.success("Workflow duplicated")
    } catch (error) {
      logger.error("Failed to duplicate workflow", { error: error instanceof Error ? error.message : String(error) })
      toast.error("Failed to duplicate workflow")
    } finally {
      setIsCreating(false)
    }
  }, [user, isCreating, currentWorkflowId, currentToolType, router, handleClosePanel])

  const handleSelectWorkflow = useCallback(
    (workflow: WorkflowItem) => {
      // Don't navigate if we're editing
      if (editingId === workflow.id) return

      // Navigate based on tool type
      if (workflow.tool_type === "style-fusion" || !workflow.tool_type) {
        router.push(`/w/${workflow.id}`)
      } else {
        router.push(`/tools/${workflow.tool_type}/${workflow.id}`)
      }
      handleClosePanel()
    },
    [router, handleClosePanel, editingId],
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

  const handleStartEdit = useCallback((e: React.MouseEvent, workflowId: string) => {
    e.stopPropagation()
    setEditingId(workflowId)
  }, [])

  const handleRename = useCallback(
    async (workflow: WorkflowItem, newName: string) => {
      const oldName = workflow.name

      // Optimistic update
      setRecentWorkflows((prev) =>
        prev.map((w) => (w.id === workflow.id ? { ...w, name: newName } : w)),
      )
      setFavoriteWorkflows((prev) =>
        prev.map((w) => (w.id === workflow.id ? { ...w, name: newName } : w)),
      )
      setEditingId(null)

      const success = await renameWorkflow(workflow.id, newName)

      if (!success) {
        // Rollback on failure
        setRecentWorkflows((prev) =>
          prev.map((w) => (w.id === workflow.id ? { ...w, name: oldName } : w)),
        )
        setFavoriteWorkflows((prev) =>
          prev.map((w) => (w.id === workflow.id ? { ...w, name: oldName } : w)),
        )
        toast.error("Failed to rename workflow")
      }
    },
    [],
  )

  const handleCancelEdit = useCallback(() => {
    setEditingId(null)
  }, [])

  const handleDelete = useCallback(
    async (e: React.MouseEvent, workflow: WorkflowItem) => {
      e.stopPropagation()

      // Don't allow deleting current workflow
      if (workflow.id === currentWorkflowId) {
        toast.error("Cannot delete the current workflow")
        return
      }

      // Optimistic update
      setRecentWorkflows((prev) => prev.filter((w) => w.id !== workflow.id))
      setFavoriteWorkflows((prev) => prev.filter((w) => w.id !== workflow.id))

      const success = await deleteWorkflow(workflow.id)

      if (!success) {
        // Rollback on failure - refetch to restore state
        if (user) {
          const [recent, favorites] = await Promise.all([
            getRecentWorkflows(user.id, { limit: 10 }),
            getFavoriteWorkflows(user.id, { limit: 10 }),
          ])
          setRecentWorkflows(recent)
          setFavoriteWorkflows(favorites)
        }
        toast.error("Failed to delete workflow")
      } else {
        toast.success("Workflow deleted")
      }
    },
    [currentWorkflowId, user],
  )

  // Filter history by current tool type if specified
  const filteredHistory = useMemo(() => {
    let workflows = recentWorkflows
    if (currentToolType) {
      workflows = workflows.filter((w) => w.tool_type === currentToolType)
    }
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      workflows = workflows.filter((w) => w.name.toLowerCase().includes(query))
    }
    return workflows
  }, [recentWorkflows, currentToolType, searchQuery])

  // Filter favorites by search
  const filteredFavorites = useMemo(() => {
    if (!searchQuery) return favoriteWorkflows
    const query = searchQuery.toLowerCase()
    return favoriteWorkflows.filter((w) => w.name.toLowerCase().includes(query))
  }, [favoriteWorkflows, searchQuery])

  // Don't show if not authenticated
  if (!user) return null

  // Render a workflow item row
  const renderWorkflowItem = (workflow: WorkflowItem) => {
    const isEditing = editingId === workflow.id
    const isCurrentWorkflow = workflow.id === currentWorkflowId

    return (
      <div
        key={workflow.id}
        onClick={() => handleSelectWorkflow(workflow)}
        className={`group w-full flex items-start gap-3 p-2.5 rounded-lg text-left transition-colors hover:bg-accent cursor-pointer ${
          isCurrentWorkflow ? "bg-accent" : ""
        }`}
      >
        <div className="flex-shrink-0 w-7 h-7 rounded-md bg-muted flex items-center justify-center text-muted-foreground">
          {getToolIcon(workflow.tool_type)}
        </div>
        <div className="flex-1 min-w-0">
          {isEditing ? (
            <InlineEdit
              value={workflow.name}
              onSave={(newName) => handleRename(workflow, newName)}
              onCancel={handleCancelEdit}
            />
          ) : (
            <div className="flex items-center gap-1">
              <span className="text-sm font-medium text-foreground truncate">
                {workflow.name}
              </span>
              {isCurrentWorkflow && (
                <span className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-node-selected" />
              )}
              <button
                onClick={(e) => handleStartEdit(e, workflow.id)}
                className="flex-shrink-0 p-0.5 rounded text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-foreground transition-opacity"
                title="Rename"
              >
                <Pencil className="w-3 h-3" />
              </button>
            </div>
          )}
          {!isEditing && <RelativeTime updatedAt={workflow.updated_at} />}
        </div>
        {!isEditing && (
          <div className="flex items-center gap-0.5">
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
            {!isCurrentWorkflow && (
              <button
                onClick={(e) => handleDelete(e, workflow)}
                className="flex-shrink-0 p-1 rounded-md text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-destructive transition-all"
                title="Delete"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}
      </div>
    )
  }

  return (
    <>
      {/* Floating Toolbar */}
      <div className="fixed left-4 top-1/2 -translate-y-1/2 z-40 flex flex-col gap-1">
        {/* Toolbar Container */}
        <div
          className="flex flex-col gap-1 p-1.5 rounded-xl border border-border/50 bg-background/80 backdrop-blur-md shadow-lg"
          style={{ boxShadow: "0 4px 24px rgba(0,0,0,0.12), inset 0 1px 0 rgba(255,255,255,0.05)" }}
        >
          {/* New Session - with dropdown */}
          <div ref={newMenuRef} className="relative">
            <button
              onClick={() => setShowNewMenu(!showNewMenu)}
              disabled={isCreating}
              className={`flex items-center justify-center w-9 h-9 rounded-lg transition-colors disabled:opacity-50 ${
                showNewMenu
                  ? "bg-accent text-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent"
              }`}
              title="New workflow"
            >
              {isCreating ? (
                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
              ) : (
                <Plus className="w-4 h-4" />
              )}
            </button>

            {/* New Menu Dropdown */}
            {showNewMenu && (
              <div
                className="absolute left-full top-0 ml-2 w-48 rounded-lg border border-border/50 bg-background/95 backdrop-blur-md shadow-xl overflow-hidden"
                style={{ boxShadow: "0 8px 32px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.05)" }}
              >
                <div className="py-1">
                  <button
                    onClick={handleNewFromTemplate}
                    className="w-full flex items-center gap-3 px-3 py-2 text-sm text-foreground hover:bg-accent transition-colors"
                  >
                    <LayoutTemplate className="w-4 h-4 text-muted-foreground" />
                    <div className="text-left">
                      <div className="font-medium">From template</div>
                      <div className="text-xs text-muted-foreground">Start with default nodes</div>
                    </div>
                  </button>
                  <button
                    onClick={handleNewBlank}
                    className="w-full flex items-center gap-3 px-3 py-2 text-sm text-foreground hover:bg-accent transition-colors"
                  >
                    <FileText className="w-4 h-4 text-muted-foreground" />
                    <div className="text-left">
                      <div className="font-medium">Blank canvas</div>
                      <div className="text-xs text-muted-foreground">Start from scratch</div>
                    </div>
                  </button>
                  {currentWorkflowId && (
                    <>
                      <div className="h-px bg-border/50 my-1 mx-2" />
                      <button
                        onClick={handleDuplicateCurrent}
                        className="w-full flex items-center gap-3 px-3 py-2 text-sm text-foreground hover:bg-accent transition-colors"
                      >
                        <Copy className="w-4 h-4 text-muted-foreground" />
                        <div className="text-left">
                          <div className="font-medium">Duplicate current</div>
                          <div className="text-xs text-muted-foreground">Copy this workflow</div>
                        </div>
                      </button>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>

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

          {/* Download Assets */}
          <button
            onClick={() => handleTogglePanel("download")}
            className={`flex items-center justify-center w-9 h-9 rounded-lg transition-colors ${
              activePanel === "download"
                ? "bg-accent text-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-accent"
            }`}
            title="Download assets"
          >
            <Download className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Download Panel (separate component) */}
      {activePanel === "download" && (
        <>
          <div className="fixed inset-0 z-30" onClick={handleClosePanel} />
          <DownloadAssetsPanel canvasRef={canvasRef} onClose={handleClosePanel} />
        </>
      )}

      {/* History/Favorites Panel */}
      {(activePanel === "history" || activePanel === "favorites") && (
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

            {/* Search */}
            <div className="px-3 py-2 border-b border-border/50">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Search..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-sm bg-muted/50 border border-border/50 rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-node-selected focus:border-node-selected"
                />
              </div>
            </div>

            {/* Panel Content - muted scrollbar */}
            <div
              className="overflow-y-auto max-h-[calc(70vh-104px)]"
              style={{
                scrollbarWidth: 'thin',
                scrollbarColor: 'rgba(0,0,0,0.15) transparent',
              }}
            >
              <style jsx>{`
                div::-webkit-scrollbar {
                  width: 6px;
                }
                div::-webkit-scrollbar-track {
                  background: transparent;
                }
                div::-webkit-scrollbar-thumb {
                  background: rgba(0,0,0,0.15);
                  border-radius: 3px;
                }
                div::-webkit-scrollbar-thumb:hover {
                  background: rgba(0,0,0,0.25);
                }
              `}</style>
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="w-5 h-5 border-2 border-node-selected border-t-transparent rounded-full animate-spin" />
                </div>
              ) : activePanel === "history" ? (
                filteredHistory.length > 0 ? (
                  <div className="p-2">
                    {filteredHistory.map((workflow) => renderWorkflowItem(workflow))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
                    <History className="w-8 h-8 text-muted-foreground/50 mb-2" />
                    <p className="text-sm text-muted-foreground">
                      {searchQuery ? "No matching workflows" : "No session history yet"}
                    </p>
                    {!searchQuery && (
                      <p className="text-xs text-muted-foreground/70 mt-1">
                        Your workflows will appear here
                      </p>
                    )}
                  </div>
                )
              ) : filteredFavorites.length > 0 ? (
                <div className="p-2">
                  {filteredFavorites.map((workflow) => renderWorkflowItem({ ...workflow, is_favorite: true }))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
                  <Heart className="w-8 h-8 text-muted-foreground/50 mb-2" />
                  <p className="text-sm text-muted-foreground">
                    {searchQuery ? "No matching favorites" : "No favorites yet"}
                  </p>
                  {!searchQuery && (
                    <p className="text-xs text-muted-foreground/70 mt-1">
                      Click the heart icon on a session to save it
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </>
  )
}
