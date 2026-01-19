import { createClient } from "./client"
import type { User } from "@supabase/supabase-js"

/**
 * Get the current authenticated user, or sign in anonymously if not authenticated.
 * This ensures every user has a proper Supabase user record.
 */
export async function getOrCreateAnonymousUser(): Promise<User | null> {
  const supabase = createClient()

  try {
    // Check if user is already authenticated
    const { data: { user }, error: getUserError } = await supabase.auth.getUser()

    if (getUserError) {
      console.error("[Auth] Error getting user:", {
        error: getUserError.message,
        code: getUserError.code,
        timestamp: new Date().toISOString(),
      })
    }

    if (user) {
      return user
    }

    // No user found, sign in anonymously
    const { data, error: signInError } = await supabase.auth.signInAnonymously()

    if (signInError) {
      console.error("[Auth] Failed to sign in anonymously:", {
        error: signInError.message,
        code: signInError.code,
        timestamp: new Date().toISOString(),
      })
      return null
    }

    if (data.user) {
      console.log("[Auth] Created anonymous user:", {
        userId: data.user.id,
        isAnonymous: data.user.is_anonymous,
        timestamp: new Date().toISOString(),
      })
    }

    return data.user
  } catch (error) {
    console.error("[Auth] Unexpected error during authentication:", {
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString(),
    })
    return null
  }
}

/**
 * Get the current user's ID, or null if not authenticated.
 * Does NOT create a new user - use getOrCreateAnonymousUser for that.
 */
export async function getCurrentUserId(): Promise<string | null> {
  const supabase = createClient()

  try {
    const { data: { user } } = await supabase.auth.getUser()
    return user?.id ?? null
  } catch (error) {
    console.error("[Auth] Error getting current user ID:", {
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString(),
    })
    return null
  }
}

/**
 * Check if the current user is anonymous (can be upgraded to a real account).
 */
export async function isAnonymousUser(): Promise<boolean> {
  const supabase = createClient()

  try {
    const { data: { user } } = await supabase.auth.getUser()
    return user?.is_anonymous ?? false
  } catch {
    return false
  }
}

/**
 * Sign out the current user.
 * For anonymous users, this effectively deletes their session.
 */
export async function signOut(): Promise<void> {
  const supabase = createClient()

  try {
    const { error } = await supabase.auth.signOut()
    if (error) {
      console.error("[Auth] Error signing out:", {
        error: error.message,
        timestamp: new Date().toISOString(),
      })
    }
  } catch (error) {
    console.error("[Auth] Unexpected error during sign out:", {
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString(),
    })
  }
}
