import { createClient } from "./client"
import { createServerClient } from "./server"
import type { User } from "@supabase/supabase-js"
import { createLogger } from "@/lib/logger"

const logger = createLogger('auth')

/**
 * Get the current authenticated user without creating an anonymous session.
 * Returns null if no user is logged in.
 */
export async function getCurrentUser(): Promise<User | null> {
  const supabase = createClient()

  try {
    const { data: { user }, error } = await supabase.auth.getUser()

    if (error || !user) {
      return null
    }

    // Return null for anonymous users - they need to sign in
    if (user.is_anonymous) {
      return null
    }

    return user
  } catch (error) {
    logger.error('Error getting current user', {
      error: error instanceof Error ? error.message : String(error),
    })
    return null
  }
}

/**
 * Get the current authenticated user, or sign in anonymously if not authenticated.
 * @deprecated Use getCurrentUser() instead - anonymous users are no longer supported
 */
export async function getOrCreateAnonymousUser(): Promise<User | null> {
  const supabase = createClient()

  try {
    // Check if user is already authenticated
    const { data: { user }, error: getUserError } = await supabase.auth.getUser()

    // If we have a valid user, return them
    if (user && !getUserError) {
      logger.info('Found existing user', {
        userId: user.id.slice(0, 8) + '...',
        isAnonymous: user.is_anonymous,
        hasEmail: !!user.email,
      })
      return user
    }

    // Log any errors but continue to anonymous sign-in
    if (getUserError) {
      logger.info('No existing session, will create anonymous user', {
        error: getUserError.message,
        code: getUserError.code,
      })
    }

    // No user found or error, sign in anonymously
    const { data, error: signInError } = await supabase.auth.signInAnonymously()

    if (signInError) {
      logger.error('Failed to sign in anonymously', {
        error: signInError.message,
        code: signInError.code,
      })
      return null
    }

    if (data.user) {
      logger.info('Created anonymous user', {
        userId: data.user.id.slice(0, 8) + '...',
        isAnonymous: data.user.is_anonymous,
      })
    }

    return data.user
  } catch (error) {
    logger.error('Unexpected error during authentication', {
      error: error instanceof Error ? error.message : String(error),
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
      logger.error('Error signing out', {
        error: error.message,
      })
    }
  } catch (error) {
    logger.error('Unexpected error during sign out', {
      error: error instanceof Error ? error.message : String(error),
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
      logger.error('Error signing in with Google', {
        error: error.message,
        code: error.code,
      })
      throw error
    }
  } catch (error) {
    logger.error('Unexpected error during Google sign-in', {
      error: error instanceof Error ? error.message : String(error),
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
    logger.error('Error getting user display info', {
      error: error instanceof Error ? error.message : String(error),
    })
    return null
  }
}

/**
 * Check if a user is anonymous (server-side).
 * Uses admin API to get user details.
 * Returns true if user is anonymous, false if authenticated, null if user not found.
 */
export async function isUserAnonymousServer(userId: string): Promise<boolean | null> {
  const supabase = createServerClient()

  try {
    const { data: userData, error: adminError } = await supabase.auth.admin.getUserById(userId)
    
    if (adminError || !userData.user) {
      // User not found is expected in auth flows - use info level
      // Actual errors (network, permissions) use error level
      const isNotFound = !userData.user || adminError?.message?.includes('not found')
      const logFn = isNotFound ? logger.info : logger.error
      logFn('Failed to check user anonymous status', {
        error: adminError?.message || 'User not found',
        userId: userId.slice(0, 8) + '...',
      })
      return null
    }

    return userData.user.is_anonymous ?? false
  } catch (error) {
    logger.error('Error checking user anonymous status', {
      error: error instanceof Error ? error.message : String(error),
      userId: userId.slice(0, 8) + '...',
    })
    return null
  }
}

/**
 * Get user email by ID (server-side).
 * Returns null if user not found or has no email.
 */
export async function getUserEmailServer(userId: string): Promise<string | null> {
  const supabase = createServerClient()

  try {
    const { data: userData, error } = await supabase.auth.admin.getUserById(userId)
    
    if (error || !userData.user) {
      return null
    }

    return userData.user.email ?? null
  } catch (error) {
    logger.debug('Failed to get user email', {
      userId: userId.slice(0, 8) + '...',
      error: error instanceof Error ? error.message : String(error),
    })
    return null
  }
}
