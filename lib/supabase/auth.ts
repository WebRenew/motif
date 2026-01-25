import { createClient } from "./client"
import { createServerClient } from "./server"
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

    // If we have a valid user, return them
    if (user && !getUserError) {
      console.log("[Auth] Found existing user:", {
        userId: user.id,
        isAnonymous: user.is_anonymous,
        email: user.email,
        timestamp: new Date().toISOString(),
      })
      return user
    }

    // Log any errors but continue to anonymous sign-in
    if (getUserError) {
      console.log("[Auth] No existing session, will create anonymous user:", {
        error: getUserError.message,
        code: getUserError.code,
        timestamp: new Date().toISOString(),
      })
    }

    // No user found or error, sign in anonymously
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

/**
 * Sign in with Google OAuth.
 * This will redirect the user to Google's login page.
 * If the user is anonymous, their account will be linked to the Google account.
 */
export async function signInWithGoogle(): Promise<void> {
  const supabase = createClient()

  try {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}`,
        queryParams: {
          access_type: "offline",
          prompt: "consent",
        },
      },
    })

    if (error) {
      console.error("[Auth] Error signing in with Google:", {
        error: error.message,
        code: error.code,
        timestamp: new Date().toISOString(),
      })
      throw error
    }
  } catch (error) {
    console.error("[Auth] Unexpected error during Google sign-in:", {
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString(),
    })
    throw error
  }
}

/**
 * Get the current user's display info (email or "Anonymous").
 */
export async function getUserDisplayInfo(): Promise<{
  id: string
  email: string | null
  isAnonymous: boolean
  avatarUrl: string | null
} | null> {
  const supabase = createClient()

  try {
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return null

    return {
      id: user.id,
      email: user.email ?? null,
      isAnonymous: user.is_anonymous ?? false,
      avatarUrl: user.user_metadata?.avatar_url ?? null,
    }
  } catch (error) {
    console.error("[Auth] Error getting user display info:", {
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString(),
    })
    return null
  }
}

/**
 * Check if a user is anonymous (server-side).
 * Uses service role to query auth.users table directly.
 * Returns true if user is anonymous, false if authenticated, null if user not found.
 */
export async function isUserAnonymousServer(userId: string): Promise<boolean | null> {
  const supabase = createServerClient()

  try {
    const { data, error } = await supabase
      .from("auth.users")
      .select("is_anonymous")
      .eq("id", userId)
      .single()

    if (error) {
      // Try the admin API instead if direct table access fails
      const { data: userData, error: adminError } = await supabase.auth.admin.getUserById(userId)
      
      if (adminError || !userData.user) {
        console.error("[Auth] Failed to check user anonymous status:", {
          error: adminError?.message || error.message,
          userId,
          timestamp: new Date().toISOString(),
        })
        return null
      }

      return userData.user.is_anonymous ?? false
    }

    return data?.is_anonymous ?? false
  } catch (error) {
    console.error("[Auth] Error checking user anonymous status:", {
      error: error instanceof Error ? error.message : String(error),
      userId,
      timestamp: new Date().toISOString(),
    })
    return null
  }
}
