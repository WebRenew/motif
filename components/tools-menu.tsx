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
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="16,18 22,12 16,6" />
      <polyline points="8,6 2,12 8,18" />
    </svg>
  )
}

function PaletteIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="8" r="2" fill="currentColor" />
      <circle cx="8" cy="14" r="2" fill="currentColor" />
      <circle cx="16" cy="14" r="2" fill="currentColor" />
    </svg>
  )
}

function TypeIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="4,7 4,4 20,4 20,7" />
      <line x1="9" y1="20" x2="15" y2="20" />
      <line x1="12" y1="4" x2="12" y2="20" />
    </svg>
  )
}

function MessageIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21,15a2,2,0,0,1-2,2H7l-4,4V5A2,2,0,0,1,5,3H19a2,2,0,0,1,2,2Z" />
    </svg>
  )
}

function SparklesIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12,2 L13,8 L19,9 L13,10 L12,16 L11,10 L5,9 L11,8 Z" />
      <path d="M19,15 L19.5,17 L22,17.5 L19.5,18 L19,20 L18.5,18 L16,17.5 L18.5,17 Z" />
    </svg>
  )
}

function HomeIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
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
        className="flex items-center justify-center w-9 h-9 rounded-xl bg-primary border border-muted-foreground/20 backdrop-blur-md"
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
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 top-full mt-2 w-64 bg-card/95 backdrop-blur-md border border-border rounded-xl shadow-xl z-50 overflow-hidden">
            <div className="p-2">
              <p className="px-3 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">Main</p>
              <button
                onClick={handleGoHome}
                className="w-full flex items-start gap-3 px-3 py-2.5 rounded-lg hover:bg-muted/50 transition-colors text-left group"
              >
                <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-muted flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                  <div className="text-muted-foreground group-hover:text-primary transition-colors">
                    <HomeIcon />
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">Style Fusion</p>
                  <p className="text-xs text-muted-foreground truncate">Combine website aesthetics</p>
                </div>
              </button>

              <div className="my-2 border-t border-border" />

              <p className="px-3 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Design Tools
              </p>
              {TOOLS.map((tool) => {
                const config = TOOL_WORKFLOW_CONFIG[tool.id]
                const IconComponent = ICON_MAP[tool.icon]
                return (
                  <button
                    key={tool.id}
                    onClick={() => handleSelectTool(tool.id)}
                    className="w-full flex items-start gap-3 px-3 py-2.5 rounded-lg hover:bg-muted/50 transition-colors text-left group"
                  >
                    <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-muted flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                      <div className="text-muted-foreground group-hover:text-primary transition-colors">
                        <IconComponent />
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground">{config.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{config.description}</p>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
