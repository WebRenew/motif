"use client"

import Link from "next/link"
import { MotifLogo } from "@/components/motif-logo"
import type { ReactNode } from "react"

interface BreadcrumbProps {
  /** The icon to display before the label */
  icon?: ReactNode
  /** The breadcrumb label text */
  label: string
  /** Background brightness (0-100) for scaling glow effect */
  backgroundBrightness?: number
}

/**
 * Breadcrumb navigation component with Motif logo pill and route label.
 * 
 * Design:
 * - Dark pill with Motif logo (links to home)
 * - Light pill with icon + label in Geist Mono font
 */
export function Breadcrumb({ icon, label, backgroundBrightness = 100 }: BreadcrumbProps) {
  const brightnessRatio = backgroundBrightness / 100

  return (
    <nav className="flex items-center gap-2" aria-label="Breadcrumb">
      {/* Logo pill - links to home */}
      <Link href="/" className="relative flex-shrink-0">
        <div 
          className="absolute inset-0 rounded-full bg-glow transition-all duration-150" 
          style={{ 
            margin: `${-4 * brightnessRatio}rem`,
            opacity: 0.4 * brightnessRatio,
            filter: `blur(${24 * brightnessRatio}px)`,
          }}
        />
        <div
          className="relative flex flex-shrink-0 items-center border border-muted-foreground/20 bg-neutral-900 bg-clip-padding text-primary-foreground backdrop-blur-md rounded-full px-3 py-2 shadow-lg hover:bg-neutral-800 transition-colors ring-2 ring-background"
          style={{ boxShadow: "inset 0 2px 8px rgba(168, 85, 247, 0.15), 0 10px 15px -3px rgba(0, 0, 0, 0.1)" }}
        >
          <MotifLogo width={45} height={16} />
        </div>
      </Link>

      {/* Route label pill */}
      <div className="flex items-center gap-1.5 border border-neutral-32 rounded-full px-3 py-1.5 bg-white/80 backdrop-blur-sm">
        {icon && (
          <span className="text-neutral-32 flex-shrink-0">
            {icon}
          </span>
        )}
        <span className="font-mono text-sm text-neutral-32 tracking-tight">
          {label}
        </span>
      </div>
    </nav>
  )
}
