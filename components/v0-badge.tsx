"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"

interface V0BadgeProps {
  fixed?: boolean
}

export function V0Badge({ fixed = true }: V0BadgeProps) {
  const [dismissed, setDismissed] = useState(true)

  if (dismissed) return null

  return (
    <div
      className={cn(
        "flex items-center gap-1 rounded-lg border border-white/12 bg-[#121212] text-white shadow-md transition-all",
        "px-2 py-1.5 text-xs sm:px-3 sm:py-2 sm:text-sm",
        "font-normal tracking-wide",
        fixed && "fixed bottom-3 z-[1000] sm:bottom-6"
      )}
      style={{
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        ...(fixed && { right: "20%" })
      }}
    >
      <a
        href="https://v0.link/charles"
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-1 text-inherit no-underline"
      >
        <span className="hidden sm:inline">Built with</span>
        <svg
          fill="currentColor"
          viewBox="0 0 147 70"
          xmlns="http://www.w3.org/2000/svg"
          className="h-4 w-4 sm:h-5 sm:w-5"
          aria-hidden="true"
        >
          <path d="M56 50.2031V14H70V60.1562C70 65.5928 65.5928 70 60.1562 70C57.5605 70 54.9982 68.9992 53.1562 67.1573L0 14H19.7969L56 50.2031Z" />
          <path d="M147 56H133V23.9531L100.953 56H133V70H96.6875C85.8144 70 77 61.1856 77 50.3125V14H91V46.1562L123.156 14H91V0H127.312C138.186 0 147 8.81439 147 19.6875V56Z" />
        </svg>
      </a>

      <button
        onClick={() => setDismissed(true)}
        className="ml-0.5 flex items-center rounded-sm bg-transparent p-0.5 text-white opacity-70 transition-opacity hover:opacity-100"
        aria-label="Dismiss badge"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-2.5 w-2.5 sm:h-3 sm:w-3"
          aria-hidden="true"
        >
          <path d="M18 6L6 18M6 6l12 12" />
        </svg>
      </button>

      <span className="sr-only">Built with v0</span>
    </div>
  )
}
