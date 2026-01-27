"use client"

import { useState, useEffect, useCallback } from "react"
import { X, Settings, Loader2 } from "lucide-react"
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
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-md mx-4 bg-[#1a1a1d] border border-white/10 rounded-2xl shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-[#C157C1]" />
            <h2 className="text-lg font-medium text-[#f0f0f2]">Agent Settings</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/5 rounded-lg transition-colors"
            aria-label="Close"
          >
            <X className="w-4 h-4 text-[#8a8a94]" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 text-[#8a8a94] animate-spin" />
            </div>
          ) : (
            <>
              <label className="block mb-2">
                <span className="text-sm font-medium text-[#f0f0f2]">Agent Rules</span>
                <span className="text-xs text-[#8a8a94] ml-2">
                  Custom instructions for the agent
                </span>
              </label>
              <textarea
                value={rules}
                onChange={(e) => {
                  if (e.target.value.length <= MAX_RULES_LENGTH) {
                    setRules(e.target.value)
                  }
                }}
                placeholder="e.g., Always use TypeScript. Prefer functional components. Keep responses concise..."
                className={cn(
                  "w-full h-32 px-3 py-2 bg-[#111114] border border-white/10 rounded-xl",
                  "text-sm text-[#f0f0f2] placeholder:text-[#8a8a94]/50",
                  "focus:outline-none focus:border-[#C157C1]/50 focus:ring-1 focus:ring-[#C157C1]/20",
                  "resize-none"
                )}
              />
              <div className="flex items-center justify-between mt-2">
                <p className="text-xs text-[#8a8a94]">
                  These rules will be added to every conversation
                </p>
                <span
                  className={cn(
                    "text-xs",
                    rules.length > MAX_RULES_LENGTH * 0.9
                      ? "text-yellow-400"
                      : "text-[#8a8a94]"
                  )}
                >
                  {rules.length}/{MAX_RULES_LENGTH}
                </span>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-white/5">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-[#8a8a94] hover:text-[#f0f0f2] hover:bg-white/5 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving || isLoading}
            className={cn(
              "px-4 py-2 text-sm font-medium rounded-lg transition-colors",
              "bg-[#C157C1] text-white hover:bg-[#C157C1]/90",
              "disabled:opacity-50 disabled:cursor-not-allowed"
            )}
          >
            {isSaving ? (
              <span className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Saving...
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
