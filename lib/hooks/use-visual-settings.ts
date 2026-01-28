"use client"

import { useState, useEffect, useCallback } from "react"

const STORAGE_KEY = "motif-visual-settings"

interface VisualSettings {
  backgroundBrightness: number // 0-100
}

const DEFAULT_SETTINGS: VisualSettings = {
  backgroundBrightness: 100,
}

export function useVisualSettings() {
  const [settings, setSettings] = useState<VisualSettings>(DEFAULT_SETTINGS)
  const [isLoaded, setIsLoaded] = useState(false)

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored) as Partial<VisualSettings>
        setSettings({ ...DEFAULT_SETTINGS, ...parsed })
      }
    } catch {
      // Ignore parse errors, use defaults
    }
    setIsLoaded(true)
  }, [])

  // Save to localStorage when settings change
  useEffect(() => {
    if (!isLoaded) return
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
    } catch {
      // Ignore storage errors
    }
  }, [settings, isLoaded])

  const setBackgroundBrightness = useCallback((value: number) => {
    setSettings((prev) => ({ ...prev, backgroundBrightness: Math.max(0, Math.min(100, value)) }))
  }, [])

  const resetToDefaults = useCallback(() => {
    setSettings(DEFAULT_SETTINGS)
  }, [])

  return {
    settings,
    isLoaded,
    setBackgroundBrightness,
    resetToDefaults,
  }
}
