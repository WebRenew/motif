"use client"

import { useState, useEffect, useCallback } from "react"
import { X, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { getUserSettings, saveAgentRules } from "@/lib/supabase/user-settings"
import { toast } from "sonner"

const MAX_RULES_LENGTH = 500

interface AgentSettingsModalProps {
  userId: string
  isOpen: boolean
  onClose: () => void
}

export function AgentSettingsModal({ userId, isOpen, onClose }: AgentSettingsModalProps) {
  const [rules, setRules] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  // Load settings when modal opens
  useEffect(() => {
    if (isOpen && userId) {
      setIsLoading(true)
      getUserSettings(userId)
        .then((settings) => {
          setRules(settings.agentRules || "")
        })
        .catch((err) => {
          console.error("Failed to load settings:", err)
          toast.error("Failed to load settings")
        })
        .finally(() => setIsLoading(false))
    }
  }, [isOpen, userId])

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown)
    }
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [isOpen, onClose])

  const handleSave = useCallback(async () => {
    setIsSaving(true)
    try {
      await saveAgentRules(userId, rules.trim() || null)
      toast.success("Settings saved")
      onClose()
    } catch (err) {
      console.error("Failed to save settings:", err)
      toast.error("Failed to save settings")
    } finally {
      setIsSaving(false)
    }
  }, [userId, rules, onClose])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-md mx-4 bg-[#111114] border border-white/5 rounded-[20px] shadow-[0_4px_24px_rgba(0,0,0,0.4),inset_0_0_0_1px_rgba(255,255,255,0.02)] animate-in fade-in zoom-in-95 duration-200 overflow-hidden">
        {/* Top gradient border */}
        <div className="pointer-events-none absolute left-0 right-0 top-0 h-px rounded-t-[20px] bg-gradient-to-r from-transparent via-[#C157C1]/40 to-transparent" />
        
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-[#0a0a0c] border-b border-white/10">
          <h2 className="text-sm font-medium text-[#f0f0f2]">Agent Rules</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            aria-label="Close"
          >
            <X className="w-4 h-4 text-[#8a8a94]" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 text-[#8a8a94] animate-spin" />
            </div>
          ) : (
            <>
              <p className="text-xs text-[#8a8a94] mb-3">
                Custom instructions added to every conversation
              </p>
              <textarea
                value={rules}
                onChange={(e) => {
                  if (e.target.value.length <= MAX_RULES_LENGTH) {
                    setRules(e.target.value)
                  }
                }}
                placeholder="e.g., Always use TypeScript. Prefer functional components. Keep responses concise..."
                className={cn(
                  "w-full h-28 px-3 py-2 bg-[#161619] border border-white/10 rounded-lg",
                  "text-sm text-[#f0f0f2] placeholder:text-[#8a8a94]/40",
                  "focus:outline-none focus:border-white/20",
                  "resize-none"
                )}
              />
              <div className="flex items-center justify-end mt-2">
                <span
                  className={cn(
                    "text-xs tabular-nums",
                    rules.length > MAX_RULES_LENGTH * 0.9
                      ? "text-[#C157C1]"
                      : "text-[#8a8a94]/60"
                  )}
                >
                  {rules.length}/{MAX_RULES_LENGTH}
                </span>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-white/10">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-sm text-[#8a8a94] hover:text-[#f0f0f2] hover:bg-white/5 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving || isLoading}
            className={cn(
              "px-3 py-1.5 text-sm font-medium rounded-lg transition-colors",
              "bg-white/10 text-[#f0f0f2] hover:bg-white/15",
              "disabled:opacity-50 disabled:cursor-not-allowed"
            )}
          >
            {isSaving ? (
              <span className="flex items-center gap-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Saving
              </span>
            ) : (
              "Save"
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
