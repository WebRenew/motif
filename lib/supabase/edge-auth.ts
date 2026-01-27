/**
 * Edge/Server Route Authentication
 *
 * Authentication utilities for API routes that need to read user session from cookies.
 * This file is separate from server.ts because next/headers can't be imported
 * in modules that are also used by client components.
 */

import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

/**
 * Create a Supabase client for edge/server routes that reads user session from cookies.
 * Use this when you need to get the authenticated user in API routes.
 */
export async function createEdgeClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Missing Supabase environment variables")
  }

  const cookieStore = await cookies()

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          try {
            cookieStore.set(name, value, options)
          } catch {
            // Cookies can only be modified in Server Actions or Route Handlers
          }
        })
      },
    },
  })
}

/**
 * Get authenticated user from cookies in edge/server routes.
 * Returns null if not authenticated or if user is anonymous.
 */
export async function getAuthenticatedUser() {
  try {
    const supabase = await createEdgeClient()
    const { data: { user }, error } = await supabase.auth.getUser()

    if (error || !user) {
      return null
    }

    // Reject anonymous users
    if (user.is_anonymous) {
      return null
    }

    return user
  } catch {
    return null
  }
}
