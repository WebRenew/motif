"use client"

import { useState, useEffect, useCallback, createContext, useContext, type ReactNode } from "react"
import { Command } from "cmdk"
import { useRouter } from "next/navigation"
import {
  Workflow,
  Palette,
  Code,
  Type,
  MessageSquare,
  Sparkles,
  Plus,
  Search,
  LogOut,
  User,
  ExternalLink,
} from "lucide-react"
import { KeyframesIcon } from "@/components/icons/keyframes"
import { useAuth } from "@/lib/context/auth-context"
import { getRecentWorkflows } from "@/lib/supabase/workflows"
import { signOut } from "@/lib/supabase/auth"
import { TOOL_WORKFLOW_CONFIG, TOOL_LIST, type ToolWorkflowType } from "@/lib/workflow/tool-workflows"
import { logger } from "@/lib/logger"

// Tool icons mapping
const TOOL_ICONS: Record<string, React.ReactNode> = {
  home: <Workflow className="w-4 h-4" />,
  code: <Code className="w-4 h-4" />,
  palette: <Palette className="w-4 h-4" />,
  type: <Type className="w-4 h-4" />,
  message: <MessageSquare className="w-4 h-4" />,
  sparkles: <Sparkles className="w-4 h-4" />,
  keyframes: <KeyframesIcon className="w-4 h-4" />,
}

interface RecentWorkflow {
  id: string
  name: string
  updated_at: string
  tool_type: string | null
}

// Context for command palette
interface CommandPaletteContextType {
  open: boolean
  setOpen: (open: boolean) => void
}

const CommandPaletteContext = createContext<CommandPaletteContextType | null>(null)

export function useCommandPalette() {
  const context = useContext(CommandPaletteContext)
  if (!context) {
    throw new Error("useCommandPalette must be used within CommandPaletteProvider")
  }
  return context
}

export function CommandPaletteProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)

  // Global keyboard listener for ⌘K
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((prev) => !prev)
      }
    }

    document.addEventListener("keydown", down)
    return () => document.removeEventListener("keydown", down)
  }, [])

  return (
    <CommandPaletteContext.Provider value={{ open, setOpen }}>
      {children}
      <CommandPalette open={open} onOpenChange={setOpen} />
    </CommandPaletteContext.Provider>
  )
}

interface CommandPaletteProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const router = useRouter()
  const { user, isAuthenticated, openAuthModal, requireAuth } = useAuth()
  const [recentWorkflows, setRecentWorkflows] = useState<RecentWorkflow[]>([])

  // Fetch recent workflows when palette opens
  useEffect(() => {
    if (!open || !isAuthenticated || !user) {
      setRecentWorkflows([])
      return
    }

    async function fetchRecent() {
      try {
        const workflows = await getRecentWorkflows(user!.id, { limit: 5 })
        setRecentWorkflows(workflows)
      } catch (error) {
        logger.error("Failed to fetch recent workflows", {
          error: error instanceof Error ? error.message : String(error),
        })
      }
    }

    fetchRecent()
  }, [open, isAuthenticated, user])

  const handleSelect = useCallback(
    (callback: () => void) => {
      onOpenChange(false)
      callback()
    },
    [onOpenChange]
  )

  const navigateToTool = useCallback(
    (toolId: ToolWorkflowType) => {
      handleSelect(() => {
        if (!requireAuth()) return
        if (toolId === "style-fusion") {
          router.push("/")
        } else {
          router.push(`/tools/${toolId}`)
        }
      })
    },
    [handleSelect, router, requireAuth]
  )

  const navigateToWorkflow = useCallback(
    (workflowId: string) => {
      handleSelect(() => {
        router.push(`/w/${workflowId}`)
      })
    },
    [handleSelect, router]
  )

  const handleNewWorkflow = useCallback(() => {
    handleSelect(() => {
      if (!requireAuth()) return
      router.push("/")
    })
  }, [handleSelect, router, requireAuth])

  const handleSignOut = useCallback(() => {
    handleSelect(async () => {
      await signOut()
      window.location.href = window.location.origin
    })
  }, [handleSelect])

  const handleSignIn = useCallback(() => {
    handleSelect(() => {
      openAuthModal()
    })
  }, [handleSelect, openAuthModal])

  // Get relative time string
  const getRelativeTime = (date: string) => {
    const now = new Date()
    const past = new Date(date)
    const diffInSeconds = Math.floor((now.getTime() - past.getTime()) / 1000)

    if (diffInSeconds < 60) return "just now"
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`
    return `${Math.floor(diffInSeconds / 604800)}w ago`
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[99999]">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in"
        onClick={() => onOpenChange(false)}
      />

      {/* Command palette */}
      <div className="absolute left-1/2 top-[20%] -translate-x-1/2 w-full max-w-[560px] px-4">
        <Command
          className="relative bg-[#111114] rounded-2xl border border-white/10 shadow-2xl overflow-hidden animate-fade-in"
          loop
        >
          {/* Top gradient border */}
          <div className="pointer-events-none absolute left-0 right-0 top-0 h-px bg-gradient-to-r from-transparent via-[#C157C1]/40 to-transparent" />

          {/* Search input */}
          <div className="flex items-center gap-3 px-4 border-b border-white/5">
            <Search className="w-4 h-4 text-[#8a8a94] flex-shrink-0" />
            <Command.Input
              autoFocus
              placeholder="Search tools, workflows, actions..."
              className="flex-1 h-14 bg-transparent text-[#f0f0f2] text-base placeholder:text-[#5a5a64] focus:outline-none"
            />
            <kbd className="hidden sm:flex items-center gap-1 px-2 py-1 rounded-md bg-white/5 border border-white/10 text-[10px] text-[#8a8a94] font-medium">
              ESC
            </kbd>
          </div>

          {/* Results list */}
          <Command.List className="max-h-[400px] overflow-y-auto p-2">
            <Command.Empty className="py-8 text-center text-sm text-[#8a8a94]">
              No results found.
            </Command.Empty>

            {/* Tools */}
            <Command.Group heading="Tools" className="mb-2">
              <Command.Item
                value="style-fusion new workflow home"
                onSelect={() => navigateToTool("style-fusion")}
                className="group flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer text-[#f0f0f2] data-[selected=true]:bg-white/5 transition-colors"
              >
                <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-[#161619] border border-white/5 text-[#8a8a94] group-data-[selected=true]:text-[#C157C1] group-data-[selected=true]:border-white/10 transition-colors">
                  <Workflow className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium">Style Fusion</div>
                  <div className="text-xs text-[#8a8a94]">Combine website aesthetics</div>
                </div>
              </Command.Item>

              {TOOL_LIST.map((toolId) => {
                const config = TOOL_WORKFLOW_CONFIG[toolId]
                return (
                  <Command.Item
                    key={toolId}
                    value={`${toolId} ${config.name} ${config.description}`}
                    onSelect={() => navigateToTool(toolId)}
                    className="group flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer text-[#f0f0f2] data-[selected=true]:bg-white/5 transition-colors"
                  >
                    <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-[#161619] border border-white/5 text-[#8a8a94] group-data-[selected=true]:text-[#C157C1] group-data-[selected=true]:border-white/10 transition-colors">
                      {TOOL_ICONS[config.icon] || <Workflow className="w-4 h-4" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium">{config.name}</div>
                      <div className="text-xs text-[#8a8a94]">{config.description}</div>
                    </div>
                  </Command.Item>
                )
              })}
            </Command.Group>

            {/* Recent Workflows - only show if authenticated */}
            {isAuthenticated && recentWorkflows.length > 0 && (
              <Command.Group heading="Recent" className="mb-2">
                {recentWorkflows.map((workflow) => (
                  <Command.Item
                    key={workflow.id}
                    value={`recent ${workflow.name} ${workflow.id}`}
                    onSelect={() => navigateToWorkflow(workflow.id)}
                    className="group flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer text-[#f0f0f2] data-[selected=true]:bg-white/5 transition-colors"
                  >
                    <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-[#161619] border border-white/5 text-[#8a8a94] group-data-[selected=true]:text-[#C157C1] group-data-[selected=true]:border-white/10 transition-colors">
                      <Workflow className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{workflow.name}</div>
                      <div className="text-xs text-[#8a8a94]">{getRelativeTime(workflow.updated_at)}</div>
                    </div>
                  </Command.Item>
                ))}
              </Command.Group>
            )}

            {/* Actions */}
            <Command.Group heading="Actions" className="mb-2">
              <Command.Item
                value="new workflow create"
                onSelect={handleNewWorkflow}
                className="group flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer text-[#f0f0f2] data-[selected=true]:bg-white/5 transition-colors"
              >
                <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-[#161619] border border-white/5 text-[#8a8a94] group-data-[selected=true]:text-[#C157C1] group-data-[selected=true]:border-white/10 transition-colors">
                  <Plus className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium">New Workflow</div>
                  <div className="text-xs text-[#8a8a94]">Create a new workflow</div>
                </div>
              </Command.Item>
            </Command.Group>

            {/* Resources */}
            <Command.Group heading="Resources">
              <Command.Item
                value="github source code repository"
                onSelect={() => handleSelect(() => window.open("https://github.com/WebRenew/motif", "_blank"))}
                className="group flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer text-[#f0f0f2] data-[selected=true]:bg-white/5 transition-colors"
              >
                <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-[#161619] border border-white/5 text-[#8a8a94] group-data-[selected=true]:text-[#C157C1] group-data-[selected=true]:border-white/10 transition-colors">
                  <ExternalLink className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium">GitHub</div>
                  <div className="text-xs text-[#8a8a94]">View source code</div>
                </div>
              </Command.Item>
            </Command.Group>

            {/* Account */}
            <Command.Group heading="Account">
              {isAuthenticated ? (
                <Command.Item
                  value="sign out logout"
                  onSelect={handleSignOut}
                  className="group flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer text-[#f0f0f2] data-[selected=true]:bg-white/5 transition-colors"
                >
                  <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-[#161619] border border-white/5 text-[#8a8a94] group-data-[selected=true]:text-[#C157C1] group-data-[selected=true]:border-white/10 transition-colors">
                    <LogOut className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium">Sign Out</div>
                    <div className="text-xs text-[#8a8a94]">Sign out of your account</div>
                  </div>
                </Command.Item>
              ) : (
                <Command.Item
                  value="sign in login google"
                  onSelect={handleSignIn}
                  className="group flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer text-[#f0f0f2] data-[selected=true]:bg-white/5 transition-colors"
                >
                  <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-[#161619] border border-white/5 text-[#8a8a94] group-data-[selected=true]:text-[#C157C1] group-data-[selected=true]:border-white/10 transition-colors">
                    <User className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium">Sign In</div>
                    <div className="text-xs text-[#8a8a94]">Sign in with Google</div>
                  </div>
                </Command.Item>
              )}
            </Command.Group>
          </Command.List>

          {/* Footer with keyboard hints */}
          <div className="flex items-center justify-between px-4 py-2.5 border-t border-white/5 text-[10px] text-[#5a5a64]">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 rounded bg-white/5 border border-white/10">↑</kbd>
                <kbd className="px-1.5 py-0.5 rounded bg-white/5 border border-white/10">↓</kbd>
                <span className="ml-1">navigate</span>
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 rounded bg-white/5 border border-white/10">↵</kbd>
                <span className="ml-1">select</span>
              </span>
            </div>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-white/5 border border-white/10">⌘</kbd>
              <kbd className="px-1.5 py-0.5 rounded bg-white/5 border border-white/10">K</kbd>
              <span className="ml-1">toggle</span>
            </span>
          </div>
        </Command>
      </div>
    </div>
  )
}
