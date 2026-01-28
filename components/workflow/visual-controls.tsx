"use client"

import { useState, useRef, useEffect } from "react"
import { SlidersHorizontal } from "lucide-react"

interface VisualControlsProps {
  backgroundBrightness: number
  onBackgroundBrightnessChange: (value: number) => void
}

export function VisualControls({
  backgroundBrightness,
  onBackgroundBrightnessChange,
}: VisualControlsProps) {
  const [isOpen, setIsOpen] = useState(false)
  const popoverRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  
  // Determine if we're in light mode (brightness > 50)
  const isLightMode = backgroundBrightness > 50

  // Close on click outside
  useEffect(() => {
    if (!isOpen) return

    function handleClickOutside(e: MouseEvent) {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false)
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [isOpen])

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setIsOpen(false)
      }
    }

    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [isOpen])

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        onClick={() => setIsOpen(!isOpen)}
        className={`p-2 transition-colors rounded-b-lg ${
          isLightMode 
            ? `border-t border-black/10 ${isOpen ? "bg-black/5" : ""} hover:bg-black/5`
            : `border-t border-border ${isOpen ? "bg-muted" : ""} hover:bg-muted`
        }`}
        aria-label="Visual controls"
        aria-expanded={isOpen}
      >
        <SlidersHorizontal className={`w-4 h-4 ${isLightMode ? "text-neutral-600" : "text-muted-foreground"}`} />
      </button>

      {isOpen && (
        <div
          ref={popoverRef}
          className={`absolute bottom-full right-0 mb-2 w-56 rounded-xl p-3 animate-fade-in transition-colors duration-150 ${
            isLightMode 
              ? "bg-white/95 border border-black/10 shadow-[0_4px_24px_rgba(0,0,0,0.15)] backdrop-blur-sm"
              : "bg-[var(--panel-bg)] border border-white/10 shadow-[0_4px_24px_rgba(0,0,0,0.4)]"
          }`}
        >
          {/* Header */}
          <div className={`text-[11px] font-semibold uppercase tracking-[0.08em] mb-3 ${
            isLightMode ? "text-neutral-500" : "text-[var(--panel-text-secondary)]"
          }`}>
            Visual Controls
          </div>

          {/* Background Brightness */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label
                htmlFor="bg-brightness"
                className={`text-[12px] ${isLightMode ? "text-neutral-800" : "text-[var(--panel-text)]"}`}
              >
                Background
              </label>
              <span className={`text-[11px] tabular-nums ${isLightMode ? "text-neutral-500" : "text-[var(--panel-text-secondary)]"}`}>
                {backgroundBrightness}%
              </span>
            </div>
            <input
              id="bg-brightness"
              type="range"
              min="0"
              max="100"
              value={100 - backgroundBrightness}
              onChange={(e) => onBackgroundBrightnessChange(100 - Number(e.target.value))}
              className={`w-full h-1.5 rounded-full appearance-none cursor-pointer ${
                isLightMode 
                  ? "bg-black/15 [&::-webkit-slider-thumb]:bg-neutral-700 [&::-moz-range-thumb]:bg-neutral-700"
                  : "bg-white/20 [&::-webkit-slider-thumb]:bg-white [&::-moz-range-thumb]:bg-white"
              } [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:shadow-sm [&::-moz-range-thumb]:w-3.5 [&::-moz-range-thumb]:h-3.5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0`}
            />
            <p className={`text-[10px] ${isLightMode ? "text-neutral-400" : "text-[var(--panel-text-muted)]"}`}>
              Dim the canvas background
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
