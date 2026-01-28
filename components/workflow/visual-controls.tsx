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
        className={`p-2 hover:bg-muted transition-colors border-t border-border rounded-b-lg ${
          isOpen ? "bg-muted" : ""
        }`}
        aria-label="Visual controls"
        aria-expanded={isOpen}
      >
        <SlidersHorizontal className="w-4 h-4 text-muted-foreground" />
      </button>

      {isOpen && (
        <div
          ref={popoverRef}
          className="absolute bottom-full right-0 mb-2 w-56 bg-[#111114] border border-white/10 rounded-xl shadow-[0_4px_24px_rgba(0,0,0,0.4)] p-3 animate-fade-in"
        >
          {/* Header */}
          <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#8a8a94] mb-3">
            Visual Controls
          </div>

          {/* Background Brightness */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label
                htmlFor="bg-brightness"
                className="text-[12px] text-[#f0f0f2]"
              >
                Background
              </label>
              <span className="text-[11px] tabular-nums text-[#8a8a94]">
                {backgroundBrightness}%
              </span>
            </div>
            <input
              id="bg-brightness"
              type="range"
              min="0"
              max="100"
              value={backgroundBrightness}
              onChange={(e) => onBackgroundBrightnessChange(Number(e.target.value))}
              className="w-full h-1.5 bg-white/10 rounded-full appearance-none cursor-pointer accent-[#C157C1] [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[#C157C1] [&::-webkit-slider-thumb]:shadow-[0_0_8px_rgba(193,87,193,0.5)] [&::-moz-range-thumb]:w-3 [&::-moz-range-thumb]:h-3 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-[#C157C1] [&::-moz-range-thumb]:border-0"
            />
            <p className="text-[10px] text-[#5a5a64]">
              Dim the canvas background
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
