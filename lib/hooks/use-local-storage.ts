"use client"

import { useState, useEffect, useCallback } from "react"

/**
 * SSR-safe localStorage hook that syncs state with localStorage.
 *
 * - Returns default value during SSR (avoids hydration mismatch)
 * - Reads from localStorage on mount (client-side only)
 * - Syncs changes back to localStorage
 * - Handles JSON serialization/deserialization
 */
export function useLocalStorage<T>(
  key: string,
  defaultValue: T,
): [T, (value: T | ((prev: T) => T)) => void] {
  // Initialize with default value for SSR safety
  const [storedValue, setStoredValue] = useState<T>(defaultValue)
  const [isHydrated, setIsHydrated] = useState(false)

  // Read from localStorage after mount
  useEffect(() => {
    try {
      const item = localStorage.getItem(key)
      if (item !== null) {
        setStoredValue(JSON.parse(item) as T)
      }
    } catch {
      // localStorage not available or JSON parse failed - silently ignore
      // This is expected in SSR or when localStorage is disabled
    }
    setIsHydrated(true)
  }, [key])

  // Update localStorage when value changes (after hydration)
  const setValue = useCallback(
    (value: T | ((prev: T) => T)) => {
      setStoredValue((prev) => {
        const newValue = value instanceof Function ? value(prev) : value
        try {
          localStorage.setItem(key, JSON.stringify(newValue))
        } catch {
          // localStorage write failed - silently ignore
        }
        return newValue
      })
    },
    [key],
  )

  // Return default value until hydrated to prevent flicker
  return [isHydrated ? storedValue : defaultValue, setValue]
}
