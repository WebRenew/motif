"use client"

import React, { useState, useEffect, useCallback, type RefObject } from "react"
import {
  X,
  LogOut,
  Workflow,
  Star,
  Heart,
  Sparkles,
  Palette,
  Code,
  Layers,
  Zap,
  Target,
  Plus,
  Search,
  Bookmark,
  Flag,
  Trophy,
  Lightbulb,
  Box,
  Database,
  Globe,
  Image,
  Layout,
  Settings,
  Users,
  Rocket,
  Cloud,
  CheckCircle,
  Circle,
  Square,
  Hexagon,
  Triangle,
  Diamond,
  Gem,
  Crown,
  Flame,
  Sun,
  Moon,
  Coffee,
  Briefcase,
  FileText,
  FolderOpen,
  ChevronDown,
} from "lucide-react"
import { useRouter } from "next/navigation"
import type { ToolWorkflowType } from "@/lib/workflow/tool-workflows"
import { TOOL_WORKFLOW_CONFIG, TOOL_LIST } from "@/lib/workflow/tool-workflows"
import { signInWithGoogle, signOut, getUserDisplayInfo } from "@/lib/supabase/auth"
import { getUserTemplates, type UserTemplate } from "@/lib/supabase/workflows"
import type { WorkflowCanvasHandle } from "@/components/workflow/workflow-canvas"
import { useAuth } from "@/lib/context/auth-context"
import { logger } from "@/lib/logger"
import { KeyframesIcon } from "@/components/icons/keyframes"

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    // Use matchMedia for more reliable detection that matches CSS behavior
    const mediaQuery = window.matchMedia("(max-width: 480px)")

    const handleChange = (e: MediaQueryListEvent | MediaQueryList) => {
      setIsMobile(e.matches)
    }

    // Set initial value
    handleChange(mediaQuery)

    // Listen for changes
    mediaQuery.addEventListener("change", handleChange)
    return () => mediaQuery.removeEventListener("change", handleChange)
  }, [])

  return isMobile
}

function usePrefersReducedMotion() {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false)

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)")

    const handleChange = (e: MediaQueryListEvent | MediaQueryList) => {
      setPrefersReducedMotion(e.matches)
    }

    handleChange(mediaQuery)
    mediaQuery.addEventListener("change", handleChange)
    return () => mediaQuery.removeEventListener("change", handleChange)
  }, [])

  return prefersReducedMotion
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

function isNewTemplate(createdAt: string): boolean {
  const now = new Date()
  const created = new Date(createdAt)
  const diffInHours = (now.getTime() - created.getTime()) / (1000 * 60 * 60)
  return diffInHours < 24
}

// Client-only component to display time-based "New" badge
// Uses useEffect to compute after hydration, avoiding SSR mismatch
function NewBadge({ createdAt }: { createdAt: string }) {
  const [isNew, setIsNew] = useState(false)

  useEffect(() => {
    setIsNew(isNewTemplate(createdAt))
  }, [createdAt])

  if (!isNew) return null

  return (
    <span className="flex-shrink-0 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-node-selected/20 text-node-selected border border-node-selected/30">
      New
    </span>
  )
}

// Client-only component to display relative time
// Uses useEffect to compute after hydration, avoiding SSR mismatch
function RelativeTime({ updatedAt }: { updatedAt: string }) {
  const [relativeTime, setRelativeTime] = useState<string>("")

  useEffect(() => {
    setRelativeTime(getRelativeTimeString(updatedAt))
  }, [updatedAt])

  if (!relativeTime) return null

  return (
    <>
      <span className="text-xs text-[#8a8a94]">•</span>
      <span className="text-xs text-[#8a8a94] tabular-nums">
        {relativeTime}
      </span>
    </>
  )
}

// Tools list derived from TOOL_WORKFLOW_CONFIG (excludes style-fusion which is the home)
const TOOLS = TOOL_LIST

// Icon components
function CodeIcon() {
  return (
    <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="16 18 22 12 16 6" />
      <polyline points="8 6 2 12 8 18" />
    </svg>
  )
}

function PaletteIcon() {
  return (
    <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="4" />
      <line x1="4.93" y1="4.93" x2="9.17" y2="9.17" />
      <line x1="14.83" y1="14.83" x2="19.07" y2="19.07" />
      <line x1="14.83" y1="9.17" x2="19.07" y2="4.93" />
      <line x1="4.93" y1="19.07" x2="9.17" y2="14.83" />
    </svg>
  )
}

function TypeIcon() {
  return (
    <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="4 7 4 4 20 4 20 7" />
      <line x1="9" y1="20" x2="15" y2="20" />
      <line x1="12" y1="4" x2="12" y2="20" />
    </svg>
  )
}

function MessageIcon() {
  return (
    <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  )
}

function SparklesIcon() {
  return (
    <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  )
}

function KeyframesIconMenu() {
  return <KeyframesIcon className="w-[18px] h-[18px]" />
}

function HomeIcon() {
  return (
    <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  )
}

function GithubIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22" />
    </svg>
  )
}

function V0Icon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 147 70" fill="currentColor" aria-label="v0 logomark">
      <path d="M56 50.2031V14H70V60.1562C70 65.5928 65.5928 70 60.1562 70C57.5605 70 54.9982 68.9992 53.1562 67.1573L0 14H19.7969L56 50.2031Z" />
      <path d="M147 56H133V23.9531L100.953 56H133V70H96.6875C85.8144 70 77 61.1856 77 50.3125V14H91V46.1562L123.156 14H91V0H127.312C138.186 0 147 8.81439 147 19.6875V56Z" />
    </svg>
  )
}

function VercelIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2L2 19.5h20L12 2z" />
    </svg>
  )
}

function WebrenewIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 250 250" fill="currentColor">
      <path fillRule="evenodd" clipRule="evenodd" d="M50.9952 62H101.122C109.342 62 116.005 68.7836 116.005 77.1515V119.577C116.005 121.683 116.583 123.711 117.621 125.25L125.019 136.212L91.7784 185.677C90.5946 187.439 88.5813 187.441 87.3949 185.683L46.6159 125.25C45.5776 123.711 45 121.683 45 119.577V70.3066C45 65.719 47.6841 62 50.9952 62ZM133.995 77.1515C133.995 68.7836 140.658 62 148.878 62H199.005C202.316 62 205 65.719 205 70.3066V119.586C205 121.687 204.426 123.71 203.393 125.247L162.784 185.677C161.6 187.439 159.587 187.441 158.4 185.683L125.019 136.212L132.387 125.247C133.42 123.71 133.995 121.687 133.995 119.586V77.1515Z" />
    </svg>
  )
}

function GoogleIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 16 16" strokeLinejoin="round">
      <path d="M8.15991 6.54543V9.64362H12.4654C12.2763 10.64 11.709 11.4837 10.8581 12.0509L13.4544 14.0655C14.9671 12.6692 15.8399 10.6182 15.8399 8.18188C15.8399 7.61461 15.789 7.06911 15.6944 6.54552L8.15991 6.54543Z" fill="#4285F4" />
      <path d="M3.6764 9.52268L3.09083 9.97093L1.01807 11.5855C2.33443 14.1963 5.03241 16 8.15966 16C10.3196 16 12.1305 15.2873 13.4542 14.0655L10.8578 12.0509C10.1451 12.5309 9.23598 12.8219 8.15966 12.8219C6.07967 12.8219 4.31245 11.4182 3.67967 9.5273L3.6764 9.52268Z" fill="#34A853" />
      <path d="M1.01803 4.41455C0.472607 5.49087 0.159912 6.70543 0.159912 7.99995C0.159912 9.29447 0.472607 10.509 1.01803 11.5854C1.01803 11.5926 3.6799 9.51991 3.6799 9.51991C3.5199 9.03991 3.42532 8.53085 3.42532 7.99987C3.42532 7.46889 3.5199 6.95983 3.6799 6.47983L1.01803 4.41455Z" fill="#FBBC05" />
      <path d="M8.15982 3.18545C9.33802 3.18545 10.3853 3.59271 11.2216 4.37818L13.5125 2.0873C12.1234 0.792777 10.3199 0 8.15982 0C5.03257 0 2.33443 1.79636 1.01807 4.41455L3.67985 6.48001C4.31254 4.58908 6.07983 3.18545 8.15982 3.18545Z" fill="#EA4335" />
    </svg>
  )
}

const ICON_MAP: Record<string, React.FC> = {
  home: HomeIcon,
  code: CodeIcon,
  palette: PaletteIcon,
  type: TypeIcon,
  message: MessageIcon,
  sparkles: SparklesIcon,
  keyframes: KeyframesIconMenu,
}

// Template icon map (for user-created workflows)
const TEMPLATE_ICON_MAP: Record<string, typeof Star> = {
  star: Star,
  heart: Heart,
  sparkles: Sparkles,
  workflow: Workflow,
  palette: Palette,
  code: Code,
  layers: Layers,
  zap: Zap,
  target: Target,
  bookmark: Bookmark,
  flag: Flag,
  trophy: Trophy,
  lightbulb: Lightbulb,
  box: Box,
  database: Database,
  globe: Globe,
  image: Image,
  layout: Layout,
  settings: Settings,
  users: Users,
  rocket: Rocket,
  cloud: Cloud,
  checkcircle: CheckCircle,
  circle: Circle,
  square: Square,
  hexagon: Hexagon,
  triangle: Triangle,
  diamond: Diamond,
  gem: Gem,
  crown: Crown,
  flame: Flame,
  sun: Sun,
  moon: Moon,
  coffee: Coffee,
  briefcase: Briefcase,
  filetext: FileText,
  folderopen: FolderOpen,
}

interface MenuItemProps {
  icon: React.ReactNode
  title: string
  description: string
  onClick: () => void
  animationDelay?: string
}

const MenuItem = React.memo(function MenuItem({ icon, title, description, onClick, animationDelay = "0ms" }: MenuItemProps) {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault()
      onClick()
    }
  }

  return (
    <button
      onClick={onClick}
      onKeyDown={handleKeyDown}
      className="group relative flex w-full items-center gap-3 rounded-xl border border-transparent p-2.5 text-left transition-all duration-200 hover:border-white/10 hover:bg-white/[0.03] overflow-hidden animate-slide-in focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-node-selected/50 focus-visible:border-white/20"
      style={{ animationDelay }}
    >
      {/* Hover gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#E5E0E5]/8 via-[#C157C1]/6 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

      {/* Icon container */}
      <div className="relative z-10 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-[10px] border border-white/5 bg-[#161619] text-[#8a8a94] transition-all duration-250 group-hover:text-[#C157C1] group-hover:border-white/10 group-hover:shadow-[0_0_20px_rgba(193,87,193,0.15)]">
        {icon}
      </div>

      {/* Content */}
      <div className="relative z-10">
        <div className="text-sm font-medium text-[#f0f0f2] transition-colors duration-200 group-hover:text-white [text-wrap:balance]">
          {title}
        </div>
        <div className="text-xs text-[#8a8a94] leading-snug">
          {description}
        </div>
      </div>
    </button>
  )
})

interface ResourceItemProps {
  href: string
  icon: React.ReactNode
  label: string
  animationDelay?: string
}

const ArrowUpRightIcon = React.memo(function ArrowUpRightIcon() {
  return (
    <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="7" y1="17" x2="17" y2="7" />
      <polyline points="7 7 17 7 17 17" />
    </svg>
  )
})

const ResourceItem = React.memo(function ResourceItem({ href, icon, label, animationDelay = "0ms" }: ResourceItemProps) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex items-center gap-2 rounded-[10px] py-2.5 px-3 text-sm text-[#8a8a94] transition-all duration-200 hover:bg-white/5 hover:text-[#f0f0f2] animate-slide-in focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-node-selected/50 focus-visible:bg-white/5"
      style={{ animationDelay }}
    >
      <span className="flex-shrink-0 opacity-60 transition-opacity duration-200 group-hover:opacity-100">
        {icon}
      </span>
      <span className="truncate">{label}</span>
      {/* Arrow up-right for external link - hidden on mobile for space */}
      <span className="hidden md:inline-block ml-auto flex-shrink-0 opacity-0 -translate-y-0.5 translate-x-[-4px] transition-all duration-200 group-hover:opacity-100 group-hover:translate-x-0 group-hover:translate-y-0 group-focus-visible:opacity-100 group-focus-visible:translate-x-0 group-focus-visible:translate-y-0">
        <ArrowUpRightIcon />
      </span>
    </a>
  )
})

// Collapsible section component for accordion behavior
interface CollapsibleSectionProps {
  title: string
  badge?: string | number
  defaultExpanded?: boolean
  children: React.ReactNode
  headerAction?: React.ReactNode
}

const CollapsibleSection = React.memo(function CollapsibleSection({
  title,
  badge,
  defaultExpanded = true,
  children,
  headerAction,
}: CollapsibleSectionProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded)
  const contentRef = React.useRef<HTMLDivElement>(null)
  const [contentHeight, setContentHeight] = useState<number | undefined>(undefined)

  // Measure content height for smooth animation
  useEffect(() => {
    if (contentRef.current) {
      const resizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
          setContentHeight(entry.contentRect.height)
        }
      })
      resizeObserver.observe(contentRef.current)
      return () => resizeObserver.disconnect()
    }
  }, [])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault()
      setIsExpanded(!isExpanded)
    }
  }

  return (
    <div className="mb-2">
      <div
        role="button"
        tabIndex={0}
        onClick={() => setIsExpanded(!isExpanded)}
        onKeyDown={handleKeyDown}
        className="group flex w-full items-center gap-2 py-2 text-left cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-node-selected/50 rounded-lg"
        aria-expanded={isExpanded}
      >
        <ChevronDown
          className={`w-4 h-4 text-[#8a8a94] transition-transform duration-200 ${
            isExpanded ? "" : "-rotate-90"
          }`}
        />
        <h2 className="text-[13px] font-semibold uppercase tracking-[0.08em] text-[#f0f0f2]">
          {title}
        </h2>
        {badge !== undefined && (
          <span className="flex-shrink-0 inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-[10px] font-medium bg-white/10 text-[#8a8a94]">
            {badge}
          </span>
        )}
        {headerAction && (
          <div className="ml-auto" onClick={(e) => e.stopPropagation()}>
            {headerAction}
          </div>
        )}
      </div>
      <div
        className="overflow-hidden transition-[max-height] duration-300 ease-in-out"
        style={{
          maxHeight: isExpanded ? (contentHeight ?? 1000) : 0,
        }}
      >
        <div ref={contentRef}>
          {children}
        </div>
      </div>
    </div>
  )
})

interface ToolsMenuProps {
  onOpenChange?: (isOpen: boolean) => void
  canvasRef?: RefObject<WorkflowCanvasHandle | null>
}

interface UserInfo {
  id: string
  email: string | null
  isAnonymous: boolean
  avatarUrl: string | null
}

export function ToolsMenu({ onOpenChange, canvasRef }: ToolsMenuProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null)
  const [isSigningIn, setIsSigningIn] = useState(false)
  const [templates, setTemplates] = useState<UserTemplate[]>([])
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const router = useRouter()
  const isMobile = useIsMobile()
  const prefersReducedMotion = usePrefersReducedMotion()
  const { requireAuth } = useAuth()

  // Fetch user info and templates when menu opens
  // Parallelizes independent fetches to reduce perceived latency
  const fetchUserInfo = useCallback(async () => {
    // First get user info (required to know if we should fetch templates)
    const info = await getUserDisplayInfo()
    setUserInfo(info)

    // If user is authenticated, fetch templates
    // Note: We can't fully parallelize because templates depend on user ID,
    // but we start showing user info immediately while templates load
    if (info && !info.isAnonymous) {
      setIsLoadingTemplates(true)
      try {
        const userTemplates = await getUserTemplates(info.id)
        setTemplates(userTemplates)
      } catch (error) {
        logger.error('Failed to fetch templates', { error: error instanceof Error ? error.message : String(error) })
      } finally {
        setIsLoadingTemplates(false)
      }
    } else {
      setTemplates([])
    }
  }, [])

  useEffect(() => {
    if (isOpen) {
      fetchUserInfo()
    }
    // fetchUserInfo is stable (empty deps), but included per exhaustive-deps rule
  }, [isOpen, fetchUserInfo])

  const handleSetOpen = (open: boolean) => {
    setIsOpen(open)
    onOpenChange?.(open)
  }

  const handleSelectTool = (toolId: ToolWorkflowType) => {
    if (!requireAuth()) return
    handleSetOpen(false)
    router.push(`/tools/${toolId}`)
  }

  const handleGoHome = () => {
    handleSetOpen(false)
    router.push("/")
  }

  const handleSaveCurrentWorkflow = () => {
    if (!requireAuth()) return
    if (canvasRef?.current) {
      canvasRef.current.openSaveModal()
    }
  }

  const handleLoadTemplate = async (templateId: string) => {
    if (!requireAuth()) return
    if (canvasRef?.current) {
      handleSetOpen(false)
      await canvasRef.current.loadTemplate(templateId)
      // Refresh templates list
      await fetchUserInfo()
    }
  }

  // Filter templates based on search query
  const filteredTemplates = searchQuery
    ? templates.filter((template) => {
        const query = searchQuery.toLowerCase()
        return (
          template.name.toLowerCase().includes(query) ||
          template.description?.toLowerCase().includes(query) ||
          template.tags.some((tag) => tag.toLowerCase().includes(query))
        )
      })
    : templates

  const handleSignInWithGoogle = async () => {
    setIsSigningIn(true)
    try {
      await signInWithGoogle()
    } catch (error) {
      logger.error('Sign in failed', { error: error instanceof Error ? error.message : String(error) })
      setIsSigningIn(false)
    }
  }

  const handleSignOut = async () => {
    await signOut()
    setUserInfo(null)
    setIsOpen(false)
    // Redirect to base URL to reset all state (clears any workflow-specific routes)
    window.location.href = window.location.origin
  }

  // Prevent body scroll when menu is open on mobile
  useEffect(() => {
    if (isOpen && isMobile) {
      document.body.style.overflow = "hidden"
      return () => { document.body.style.overflow = "" }
    }
  }, [isOpen, isMobile])

  return (
    <div className="relative">
      <button
        onClick={() => handleSetOpen(!isOpen)}
        className="relative z-50 flex items-center justify-center w-9 h-9 rounded-xl bg-primary border border-muted-foreground/20 backdrop-blur-md"
        style={{ boxShadow: "inset 0 2px 8px rgba(168, 85, 247, 0.15), 0 10px 15px -3px rgba(0, 0, 0, 0.1)" }}
        aria-label="Tools menu"
      >
        {isOpen ? (
          <X className="w-4 h-4 text-primary-foreground" />
        ) : (
          <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="3" cy="3" r="1.5" fill="white" />
            <circle cx="8" cy="3" r="1.5" fill="white" />
            <circle cx="13" cy="3" r="1.5" fill="white" />
            <circle cx="3" cy="8" r="1.5" fill="white" />
            <circle cx="8" cy="8" r="1.5" fill="white" />
            <circle cx="13" cy="8" r="1.5" fill="white" />
            <circle cx="3" cy="13" r="1.5" fill="white" />
            <circle cx="8" cy="13" r="1.5" fill="white" />
            <circle cx="13" cy="13" r="1.5" fill="white" />
          </svg>
        )}
      </button>

      {isOpen && (
        <>
          {/* Desktop: backdrop for clicking outside */}
          {!isMobile && (
            <div 
              className="fixed inset-0 z-40" 
              onClick={() => handleSetOpen(false)} 
            />
          )}
          
          {/* Menu panel - mobile: fullscreen, desktop: dropdown */}
          <div 
            className={`
              menu-backglow
              ${isMobile 
                ? "fixed inset-0 w-[100dvw] h-[100dvh]" 
                : "absolute right-0 top-full mt-2 z-50"
              }
            `}
            style={isMobile ? { zIndex: 9999999999999 } : undefined}
          >
            <div 
              className={`
                relative bg-[#111114] shadow-[0_4px_24px_rgba(0,0,0,0.4),inset_0_0_0_1px_rgba(255,255,255,0.02)] animate-fade-in
                ${isMobile 
                  ? "flex flex-col w-full h-full overflow-y-auto overflow-x-hidden" 
                  : "flex gap-10 rounded-[20px] border border-white/5 p-6 backdrop-blur-sm bg-[#111114]/95"
                }
              `}
            >
              {/* Mobile header with close button */}
              {isMobile && (
                <div className="sticky top-0 z-10 flex items-center justify-between p-4 pb-2 bg-[#111114] border-b border-white/5">
                  <span className="text-lg font-semibold text-[#f0f0f2]">Menu</span>
                  <button
                    onClick={() => handleSetOpen(false)}
                    className="flex items-center justify-center w-9 h-9 rounded-xl bg-white/5 border border-white/10 text-[#8a8a94] hover:text-white hover:bg-white/10 transition-colors"
                    aria-label="Close menu"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              )}
              
              {/* Desktop: top gradient border */}
              {!isMobile && (
                <div className="pointer-events-none absolute left-0 right-0 top-0 h-px rounded-t-[20px] bg-gradient-to-r from-transparent via-[#C157C1]/40 to-transparent" />
              )}
              
              {/* Mobile content wrapper with padding */}
              <div className={isMobile ? "flex flex-col flex-1 p-4 pt-2" : "contents"}>
            
            {/* Tools Column */}
            <div className={isMobile ? "w-full min-w-0" : "min-w-[280px]"}>
              <CollapsibleSection title="Tools" defaultExpanded={true}>
                <div className="space-y-0.5 max-h-[calc(100vh-200px)] overflow-y-auto scrollbar-none">
                  <MenuItem
                    icon={<Workflow className="w-[18px] h-[18px]" />}
                    title="Style Fusion"
                    description="Combine website aesthetics"
                    onClick={handleGoHome}
                    animationDelay={prefersReducedMotion ? "0ms" : "0ms"}
                  />

                  {TOOLS.map((toolId, index) => {
                    const config = TOOL_WORKFLOW_CONFIG[toolId]
                    const IconComponent = ICON_MAP[config.icon]
                    return (
                      <MenuItem
                        key={toolId}
                        icon={<IconComponent />}
                        title={config.name}
                        description={config.description}
                        onClick={() => handleSelectTool(toolId)}
                        animationDelay={prefersReducedMotion ? "0ms" : `${(index + 1) * 50}ms`}
                      />
                    )
                  })}
                </div>
              </CollapsibleSection>

              {/* My Workflows Section */}
              {userInfo && !userInfo.isAnonymous && (
                <CollapsibleSection
                  title="My Workflows"
                  badge={templates.length > 0 ? templates.length : undefined}
                  defaultExpanded={false}
                  headerAction={
                    <button
                      onClick={handleSaveCurrentWorkflow}
                      className="p-1.5 rounded-lg hover:bg-white/5 transition-colors text-node-selected focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-node-selected/50"
                      title="Save current workflow"
                      aria-label="Save current workflow as template"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  }
                >
                  {/* Progressive Search - only show if 5+ templates */}
                  {templates.length >= 5 && (
                    <div className="mb-3">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8a8a94] pointer-events-none" />
                        <input
                          type="text"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          placeholder="Search workflows..."
                          autoComplete="off"
                          aria-label="Search workflows"
                          className="w-full pl-9 pr-9 py-2 bg-[#1a1a1f] border border-white/5 rounded-lg text-[#f0f0f2] text-sm placeholder:text-[#8a8a94] focus:outline-none focus:ring-2 focus:ring-node-selected/50 focus:border-white/20 transition-colors"
                        />
                        {searchQuery && (
                          <button
                            onClick={() => setSearchQuery("")}
                            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-white/10 rounded transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-node-selected/50"
                            aria-label="Clear search"
                          >
                            <X className="w-3 h-3 text-[#8a8a94]" />
                          </button>
                        )}
                      </div>
                      <div className="mt-1 text-xs text-[#8a8a94] px-1 tabular-nums">
                        {filteredTemplates.length} of {templates.length} workflows
                      </div>
                    </div>
                  )}

                  {/* Templates List */}
                  <div className="relative">
                    {/* Scroll gradient indicators */}
                    {filteredTemplates.length > 5 && (
                      <>
                        <div className="pointer-events-none absolute top-0 left-0 right-0 h-4 bg-gradient-to-b from-[#111114] to-transparent z-10" />
                        <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-4 bg-gradient-to-t from-[#111114] to-transparent z-10" />
                      </>
                    )}
                    <div className="space-y-0.5 max-h-[300px] overflow-y-auto">
                      {isLoadingTemplates ? (
                        <div className="flex items-center justify-center py-8">
                          <div className="w-5 h-5 border-2 border-node-selected border-t-transparent rounded-full animate-spin" />
                        </div>
                      ) : filteredTemplates.length > 0 ? (
                        filteredTemplates.map((template, index) => {
                          const TemplateIcon = TEMPLATE_ICON_MAP[template.icon] || Workflow
                          const isEmoji = !TEMPLATE_ICON_MAP[template.icon] && template.icon.length <= 2

                          const handleKeyDown = (e: React.KeyboardEvent) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault()
                              handleLoadTemplate(template.id)
                            }
                          }

                          return (
                            <button
                              key={template.id}
                              onClick={() => handleLoadTemplate(template.id)}
                              onKeyDown={handleKeyDown}
                              className="group relative flex w-full items-start gap-2.5 rounded-xl border border-transparent p-2 text-left transition-all duration-200 hover:border-white/10 hover:bg-white/[0.03] animate-slide-in focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-node-selected/50 focus-visible:border-white/20"
                              style={{ animationDelay: prefersReducedMotion ? "0ms" : `${index * 30}ms` }}
                            >
                              <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg border border-white/5 bg-[#161619] text-[#8a8a94] transition-all duration-250 group-hover:text-[#C157C1] group-hover:border-white/10">
                                {isEmoji ? (
                                  <span className="text-base leading-none">{template.icon}</span>
                                ) : (
                                  <TemplateIcon className="w-3.5 h-3.5" />
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <div className="text-sm font-medium text-[#f0f0f2] truncate group-hover:text-white transition-colors [text-wrap:balance]">
                                    {template.name}
                                  </div>
                                  <NewBadge createdAt={template.created_at} />
                                </div>
                                <div className="flex items-center gap-1.5 mt-0.5">
                                  <span className="text-xs text-[#8a8a94] tabular-nums">
                                    {template.node_count} {template.node_count === 1 ? 'node' : 'nodes'}
                                  </span>
                                  <RelativeTime updatedAt={template.updated_at} />
                                  {template.tags.length > 0 && (
                                    <>
                                      <span className="text-xs text-[#8a8a94]">•</span>
                                      {template.tags.slice(0, 2).map((tag) => (
                                        <span key={tag} className="text-xs text-node-selected/70">
                                          #{tag}
                                        </span>
                                      ))}
                                    </>
                                  )}
                                </div>
                              </div>
                            </button>
                          )
                        })
                      ) : searchQuery ? (
                        <div className="text-center py-6 text-[#8a8a94] text-sm">
                          No workflows match "{searchQuery}"
                        </div>
                      ) : (
                        <div className="text-center py-6 text-[#8a8a94] text-sm">
                          No saved workflows yet.<br/>
                          <button
                            onClick={handleSaveCurrentWorkflow}
                            className="mt-2 text-node-selected hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-node-selected/50 rounded px-1"
                          >
                            Save your first workflow
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </CollapsibleSection>
              )}
            </div>

            {/* Divider */}
            <div className={isMobile 
              ? "my-4 h-px w-full bg-gradient-to-r from-transparent via-white/10 to-transparent" 
              : "mx-2 w-px bg-gradient-to-b from-transparent via-white/10 to-transparent"
            } />

            {/* Resources Column */}
            <div className={isMobile ? "w-full min-w-0" : "min-w-[240px]"}>
              <h2 className="mb-4 md:mb-6 text-[13px] font-semibold uppercase tracking-[0.08em] text-[#f0f0f2]">
                Resources
              </h2>
              
              <div className={isMobile ? "flex flex-col" : ""}>
                <ResourceItem
                  href="https://github.com/WebRenew/motif"
                  icon={<GithubIcon />}
                  label="Github"
                  animationDelay={prefersReducedMotion ? "0ms" : "50ms"}
                />
                <ResourceItem
                  href="https://v0.link/VJ5mqrg"
                  icon={<V0Icon />}
                  label="v0 Template"
                  animationDelay={prefersReducedMotion ? "0ms" : "100ms"}
                />
                <ResourceItem
                  href="https://vercel.com/blog/ai-sdk-6"
                  icon={<VercelIcon />}
                  label="AI SDK 6"
                  animationDelay={prefersReducedMotion ? "0ms" : "150ms"}
                />
                <ResourceItem
                  href="https://vercel.com/ai-gateway"
                  icon={<VercelIcon />}
                  label="AI Gateway"
                  animationDelay={prefersReducedMotion ? "0ms" : "200ms"}
                />
                <ResourceItem
                  href="https://webrenew.com/tools"
                  icon={<WebrenewIcon />}
                  label="More tools"
                  animationDelay={prefersReducedMotion ? "0ms" : "250ms"}
                />
              </div>

              {/* Account Section */}
              <div className="mt-6 pt-4 border-t border-white/10">
                <div className="mb-3 text-[10px] font-medium uppercase tracking-[0.12em] text-[#5a5a64] pl-1">
                  Account
                </div>
                
                {userInfo && !userInfo.isAnonymous ? (
                  // Signed in user
                  <div className="animate-slide-in" style={{ animationDelay: prefersReducedMotion ? "0ms" : "300ms" }}>
                    <div className="flex items-center gap-3 py-2 px-1 mb-2">
                      {userInfo.avatarUrl ? (
                        <img
                          src={userInfo.avatarUrl}
                          alt=""
                          className="w-8 h-8 rounded-full"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-[#f0f0f2] text-sm font-medium">
                          {userInfo.email?.[0]?.toUpperCase() ?? "U"}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-[#f0f0f2] truncate">
                          {userInfo.email}
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={handleSignOut}
                      className="group flex items-center gap-2 w-full rounded-[10px] py-2.5 px-3 text-sm text-[#8a8a94] transition-all duration-200 hover:bg-white/5 hover:text-[#f0f0f2] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-node-selected/50"
                    >
                      <LogOut className="w-4 h-4 opacity-60 group-hover:opacity-100" />
                      <span>Sign out</span>
                    </button>
                  </div>
                ) : (
                  // Anonymous user - show sign in button
                  <button
                    onClick={handleSignInWithGoogle}
                    disabled={isSigningIn}
                    className="group relative flex w-full items-center gap-3 rounded-xl border border-white/10 bg-white p-3 text-left transition-all duration-200 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed animate-slide-in focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400"
                    style={{ animationDelay: prefersReducedMotion ? "0ms" : "300ms" }}
                  >
                    <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center">
                      <GoogleIcon />
                    </div>
                    <div className="text-sm font-medium text-gray-800">
                      {isSigningIn ? "Signing in..." : "Continue with Google"}
                    </div>
                  </button>
                )}
              </div>
            </div>
            
              {/* Close mobile content wrapper */}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
