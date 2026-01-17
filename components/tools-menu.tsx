"use client"

import type React from "react"
import { useState } from "react"
import { X } from "lucide-react"
import { useRouter } from "next/navigation"
import type { ToolWorkflowType } from "@/lib/workflow/tool-workflows"
import { TOOL_WORKFLOW_CONFIG } from "@/lib/workflow/tool-workflows"

const TOOLS: { id: ToolWorkflowType; icon: string }[] = [
  { id: "component-extractor", icon: "code" },
  { id: "color-palette", icon: "palette" },
  { id: "typography-matcher", icon: "type" },
  { id: "design-critique", icon: "message" },
  { id: "brand-kit", icon: "sparkles" },
]

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

const ICON_MAP: Record<string, React.FC> = {
  home: HomeIcon,
  code: CodeIcon,
  palette: PaletteIcon,
  type: TypeIcon,
  message: MessageIcon,
  sparkles: SparklesIcon,
}

interface MenuItemProps {
  icon: React.ReactNode
  title: string
  description: string
  onClick: () => void
  animationDelay?: string
}

function MenuItem({ icon, title, description, onClick, animationDelay = "0ms" }: MenuItemProps) {
  return (
    <button
      onClick={onClick}
      className="group relative flex w-full items-center gap-3.5 rounded-xl border border-transparent p-3 text-left transition-all duration-200 hover:border-white/10 hover:bg-white/5 overflow-hidden animate-slide-in"
      style={{ animationDelay }}
    >
      {/* Hover gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#E5E0E5]/8 via-[#C157C1]/6 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
      
      {/* Icon container */}
      <div className="relative z-10 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[10px] border border-white/10 bg-[#161619] text-[#8a8a94] transition-all duration-250 group-hover:text-[#C157C1] group-hover:shadow-[0_0_20px_rgba(193,87,193,0.15)]">
        {icon}
      </div>
      
      {/* Content */}
      <div className="relative z-10">
        <div className="text-sm font-medium text-[#f0f0f2] transition-colors duration-200 group-hover:text-white">
          {title}
        </div>
        <div className="text-xs text-[#8a8a94] leading-snug">
          {description}
        </div>
      </div>
    </button>
  )
}

interface ResourceItemProps {
  href: string
  icon: React.ReactNode
  label: string
  animationDelay?: string
}

function ArrowUpRightIcon() {
  return (
    <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="7" y1="17" x2="17" y2="7" />
      <polyline points="7 7 17 7 17 17" />
    </svg>
  )
}

function ResourceItem({ href, icon, label, animationDelay = "0ms" }: ResourceItemProps) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex items-center gap-2.5 rounded-[10px] py-3 px-4 text-sm text-[#8a8a94] whitespace-nowrap transition-all duration-200 hover:bg-white/5 hover:text-[#f0f0f2] animate-slide-in"
      style={{ animationDelay }}
    >
      <span className="opacity-60 transition-opacity duration-200 group-hover:opacity-100">
        {icon}
      </span>
      <span>{label}</span>
      {/* Arrow up-right for external link */}
      <span className="ml-2 opacity-0 -translate-y-0.5 translate-x-[-4px] transition-all duration-200 group-hover:opacity-100 group-hover:translate-x-0 group-hover:translate-y-0">
        <ArrowUpRightIcon />
      </span>
    </a>
  )
}

export function ToolsMenu() {
  const [isOpen, setIsOpen] = useState(false)
  const router = useRouter()

  const handleSelectTool = (toolId: ToolWorkflowType) => {
    setIsOpen(false)
    router.push(`/tools/${toolId}`)
  }

  const handleGoHome = () => {
    setIsOpen(false)
    router.push("/")
  }

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
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
          {/* Backdrop */}
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          
          {/* Menu panel with animated backglow */}
          <div className="absolute right-0 top-full z-50 mt-2 menu-backglow">
            <div 
              className="relative flex gap-10 rounded-[20px] border border-white/5 bg-[#111114]/95 backdrop-blur-sm p-6 shadow-[0_4px_24px_rgba(0,0,0,0.4),inset_0_0_0_1px_rgba(255,255,255,0.02)] animate-fade-in"
            >
              {/* Top gradient border */}
              <div className="pointer-events-none absolute left-0 right-0 top-0 h-px rounded-t-[20px] bg-gradient-to-r from-transparent via-[#C157C1]/40 to-transparent" />
            
            {/* Tools Column */}
            <div className="min-w-[280px]">
              <h2 className="mb-6 text-[13px] font-semibold uppercase tracking-[0.08em] text-[#f0f0f2]">
                Tools
              </h2>
              
              {/* Main Section */}
              <div className="mb-3 text-[10px] font-medium uppercase tracking-[0.12em] text-[#5a5a64] pl-1">
                Main
              </div>
              
              <MenuItem
                icon={<HomeIcon />}
                title="Style Fusion"
                description="Combine website aesthetics"
                onClick={handleGoHome}
                animationDelay="0ms"
              />

              {/* Design Tools Section */}
              <div className="mb-3 mt-6 text-[10px] font-medium uppercase tracking-[0.12em] text-[#5a5a64] pl-1">
                Design Tools
              </div>
              
              {TOOLS.map((tool, index) => {
                const config = TOOL_WORKFLOW_CONFIG[tool.id]
                const IconComponent = ICON_MAP[tool.icon]
                return (
                  <MenuItem
                    key={tool.id}
                    icon={<IconComponent />}
                    title={config.name}
                    description={config.description}
                    onClick={() => handleSelectTool(tool.id)}
                    animationDelay={`${(index + 1) * 50}ms`}
                  />
                )
              })}
            </div>

            {/* Divider */}
            <div className="mx-2 w-px bg-gradient-to-b from-transparent via-white/10 to-transparent" />

            {/* Resources Column */}
            <div className="min-w-[240px]">
              <h2 className="mb-6 text-[13px] font-semibold uppercase tracking-[0.08em] text-[#f0f0f2]">
                Resources
              </h2>
              
              <ResourceItem
                href="https://github.com/WebRenew/motif"
                icon={<GithubIcon />}
                label="Github"
                animationDelay="50ms"
              />
              <ResourceItem
                href="https://v0.link/VJ5mqrg"
                icon={<V0Icon />}
                label="v0 Template"
                animationDelay="100ms"
              />
              <ResourceItem
                href="https://vercel.com/blog/ai-sdk-6"
                icon={<VercelIcon />}
                label="Learn more about AI SDK 6"
                animationDelay="150ms"
              />
              <ResourceItem
                href="https://vercel.com/ai-gateway"
                icon={<VercelIcon />}
                label="Learn more about AI Gateway"
                animationDelay="200ms"
              />
              <ResourceItem
                href="https://webrenew.com/tools"
                icon={<WebrenewIcon />}
                label="More free tools"
                animationDelay="250ms"
              />
            </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
