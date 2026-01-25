"use client"

import { createContext, useContext, useEffect, useState, useCallback, useRef, type ReactNode } from "react"
import { createClient } from "@/lib/supabase/client"
import type { User } from "@supabase/supabase-js"

interface AuthContextType {
  user: User | null
  isLoading: boolean
  isAuthenticated: boolean
  showAuthModal: boolean
  openAuthModal: () => void
  closeAuthModal: () => void
  requireAuth: (callback?: () => void) => boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [showAuthModal, setShowAuthModal] = useState(false)
  // Use ref for pending callback to avoid subscription churn
  const pendingCallbackRef = useRef<(() => void) | null>(null)

  // Check if user is authenticated (not anonymous)
  const isAuthenticated = user !== null && !user.is_anonymous

  useEffect(() => {
    const supabase = createClient()

    // Get initial session
    const getInitialSession = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        setUser(user)
      } catch {
        setUser(null)
      } finally {
        setIsLoading(false)
      }
    }

    getInitialSession()

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        const currentUser = session?.user ?? null
        setUser(currentUser)
        
        // If user just signed in and we have a pending callback, execute it
        if (event === 'SIGNED_IN' && currentUser && !currentUser.is_anonymous && pendingCallbackRef.current) {
          pendingCallbackRef.current()
          pendingCallbackRef.current = null
          setShowAuthModal(false)
        }
      }
    )

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  const openAuthModal = useCallback(() => {
    setShowAuthModal(true)
  }, [])

  const closeAuthModal = useCallback(() => {
    setShowAuthModal(false)
    pendingCallbackRef.current = null
  }, [])

  // Returns true if authenticated, shows modal and stores callback if not
  const requireAuth = useCallback((callback?: () => void): boolean => {
    if (isAuthenticated) {
      return true
    }
    
    if (callback) {
      pendingCallbackRef.current = callback
    }
    setShowAuthModal(true)
    return false
  }, [isAuthenticated])

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated,
        showAuthModal,
        openAuthModal,
        closeAuthModal,
        requireAuth,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}
