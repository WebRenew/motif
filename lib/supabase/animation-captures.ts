import { createClient } from "./client"
import { createServerClient } from "./server"

// UUID format validation regex for trust boundary protection
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function isValidUUID(id: string): boolean {
  return UUID_REGEX.test(id)
}

// Length limits
const MAX_URL_LENGTH = 2048
const MAX_SELECTOR_LENGTH = 200
const MAX_PAGE_TITLE_LENGTH = 500

export interface AnimationContext {
  frames?: Array<{
    timestamp: number
    transform?: string
    opacity?: string
    [key: string]: unknown
  }>
  keyframes?: Record<string, Array<{
    offset: string
    styles: string
  }>>
  libraries?: {
    gsap?: boolean
    framerMotion?: boolean
    animejs?: boolean
    threejs?: boolean
    lottie?: boolean
  }
  computedStyles?: {
    animation?: string
    transition?: string
    willChange?: string
  }
  html?: string
  boundingBox?: {
    x: number
    y: number
    width: number
    height: number
  }
  error?: string
}

export interface AnimationCapture {
  id: string
  user_id: string
  url: string
  page_title?: string
  selector?: string
  duration: number
  replay_url?: string
  session_id?: string
  animation_context: AnimationContext
  screenshot_before?: string
  screenshot_after?: string
  created_at: string
  updated_at: string
}

export interface CreateAnimationCaptureInput {
  url: string
  pageTitle?: string
  selector?: string
  duration: number
  replayUrl?: string
  sessionId?: string
  animationContext: AnimationContext
  screenshotBefore?: string
  screenshotAfter?: string
}

/**
 * Save an animation capture to the database (client-side).
 */
export async function saveAnimationCapture(
  userId: string,
  input: CreateAnimationCaptureInput,
): Promise<string | null> {
  const supabase = createClient()
  return saveAnimationCaptureWithClient(supabase, userId, input)
}

/**
 * Save an animation capture to the database (server-side).
 * Uses service role key to bypass RLS - caller must validate userId.
 */
export async function saveAnimationCaptureServer(
  userId: string,
  input: CreateAnimationCaptureInput,
): Promise<string | null> {
  const supabase = createServerClient()
  return saveAnimationCaptureWithClient(supabase, userId, input)
}

/**
 * Internal helper to save with any Supabase client.
 */
async function saveAnimationCaptureWithClient(
  supabase: ReturnType<typeof createClient> | ReturnType<typeof createServerClient>,
  userId: string,
  input: CreateAnimationCaptureInput,
): Promise<string | null> {
  // Validate and sanitize inputs
  const url = input.url.slice(0, MAX_URL_LENGTH)
  const selector = input.selector?.slice(0, MAX_SELECTOR_LENGTH)
  const pageTitle = input.pageTitle?.slice(0, MAX_PAGE_TITLE_LENGTH)
  const duration = Math.min(Math.max(input.duration, 1000), 10000)

  const { data, error } = await supabase
    .from("animation_captures")
    .insert({
      user_id: userId,
      url,
      page_title: pageTitle,
      selector,
      duration,
      replay_url: input.replayUrl,
      session_id: input.sessionId,
      animation_context: input.animationContext,
      screenshot_before: input.screenshotBefore,
      screenshot_after: input.screenshotAfter,
    })
    .select("id")
    .single()

  if (error) {
    console.error("[saveAnimationCapture] Failed to save capture:", {
      error: error.message,
      code: error.code,
      userId,
      url: input.url.slice(0, 100),
      timestamp: new Date().toISOString(),
    })
    return null
  }

  return data.id
}

/**
 * Get an animation capture by ID.
 */
export async function getAnimationCapture(
  captureId: string,
): Promise<AnimationCapture | null> {
  if (!isValidUUID(captureId)) {
    console.warn("[getAnimationCapture] Invalid capture ID format:", {
      captureId,
      timestamp: new Date().toISOString(),
    })
    return null
  }

  const supabase = createClient()

  const { data, error } = await supabase
    .from("animation_captures")
    .select("*")
    .eq("id", captureId)
    .single()

  if (error) {
    console.error("[getAnimationCapture] Failed to fetch capture:", {
      error: error.message,
      code: error.code,
      captureId,
      timestamp: new Date().toISOString(),
    })
    return null
  }

  return {
    id: data.id,
    user_id: data.user_id,
    url: data.url,
    page_title: data.page_title,
    selector: data.selector,
    duration: data.duration,
    replay_url: data.replay_url,
    session_id: data.session_id,
    animation_context: data.animation_context as AnimationContext,
    screenshot_before: data.screenshot_before,
    screenshot_after: data.screenshot_after,
    created_at: data.created_at,
    updated_at: data.updated_at,
  }
}

// Default pagination limits
const DEFAULT_CAPTURE_LIMIT = 50
const MAX_CAPTURE_LIMIT = 200

/**
 * Get animation captures for a user, ordered by most recently created.
 */
export async function getUserAnimationCaptures(
  userId: string,
  options: { limit?: number; offset?: number } = {},
): Promise<Omit<AnimationCapture, "animation_context" | "screenshot_before" | "screenshot_after">[]> {
  const supabase = createClient()

  const limit = Math.min(options.limit || DEFAULT_CAPTURE_LIMIT, MAX_CAPTURE_LIMIT)
  const offset = options.offset || 0

  const { data, error } = await supabase
    .from("animation_captures")
    .select("id, user_id, url, page_title, selector, duration, replay_url, session_id, created_at, updated_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1)

  if (error) {
    console.error("[getUserAnimationCaptures] Failed to fetch captures:", {
      error: error.message,
      code: error.code,
      userId,
      limit,
      offset,
      timestamp: new Date().toISOString(),
    })
    return []
  }

  return data || []
}

/**
 * Delete an animation capture.
 */
export async function deleteAnimationCapture(
  captureId: string,
): Promise<boolean> {
  if (!isValidUUID(captureId)) {
    console.warn("[deleteAnimationCapture] Invalid capture ID format:", {
      captureId,
      timestamp: new Date().toISOString(),
    })
    return false
  }

  const supabase = createClient()

  const { error } = await supabase
    .from("animation_captures")
    .delete()
    .eq("id", captureId)

  if (error) {
    console.error("[deleteAnimationCapture] Failed to delete capture:", {
      error: error.message,
      code: error.code,
      captureId,
      timestamp: new Date().toISOString(),
    })
    return false
  }

  return true
}

/**
 * Check if a URL was recently captured (for potential caching/deduplication).
 * Returns the most recent capture within the last hour if it exists.
 */
export async function getRecentCaptureForUrl(
  userId: string,
  url: string,
): Promise<AnimationCapture | null> {
  const supabase = createClient()

  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()

  const { data, error } = await supabase
    .from("animation_captures")
    .select("*")
    .eq("user_id", userId)
    .eq("url", url)
    .gte("created_at", oneHourAgo)
    .order("created_at", { ascending: false })
    .limit(1)
    .single()

  if (error) {
    // Not found is expected, only log actual errors
    if (error.code !== "PGRST116") {
      console.error("[getRecentCaptureForUrl] Failed to check recent capture:", {
        error: error.message,
        code: error.code,
        userId,
        timestamp: new Date().toISOString(),
      })
    }
    return null
  }

  return {
    id: data.id,
    user_id: data.user_id,
    url: data.url,
    page_title: data.page_title,
    selector: data.selector,
    duration: data.duration,
    replay_url: data.replay_url,
    session_id: data.session_id,
    animation_context: data.animation_context as AnimationContext,
    screenshot_before: data.screenshot_before,
    screenshot_after: data.screenshot_after,
    created_at: data.created_at,
    updated_at: data.updated_at,
  }
}
