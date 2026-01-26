import { createClient } from "./client"
import { createServerClient } from "./server"
import { isValidUUID } from "@/lib/utils"
import { createLogger } from "@/lib/logger"

const logger = createLogger('animation-captures')

// Length limits
const MAX_URL_LENGTH = 2048
const MAX_SELECTOR_LENGTH = 200
const MAX_PAGE_TITLE_LENGTH = 500

export type CaptureStatus = 'pending' | 'processing' | 'completed' | 'failed'

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
  video_url?: string
  status: CaptureStatus
  error_message?: string
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

export interface CreatePendingCaptureInput {
  url: string
  selector?: string
  duration: number
  workflowId?: string  // For upsert support
  nodeId?: string      // For upsert support
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
    logger.error('Failed to save capture', {
      error: error.message,
      code: error.code,
      userId,
      url: input.url.slice(0, 100),
    })
    return null
  }

  return data.id
}

/**
 * Create a pending animation capture (for async processing).
 * If workflowId and nodeId are provided, upserts (updates existing record for same node).
 * Returns the capture ID immediately so client can poll for status.
 */
export async function createPendingCaptureServer(
  userId: string,
  input: CreatePendingCaptureInput,
): Promise<string | null> {
  const supabase = createServerClient()

  const url = input.url.slice(0, MAX_URL_LENGTH)
  const selector = input.selector?.slice(0, MAX_SELECTOR_LENGTH)
  const duration = Math.min(Math.max(input.duration, 1000), 10000)

  // If workflow/node provided, use upsert to update existing capture
  if (input.workflowId && input.nodeId && isValidUUID(input.workflowId) && isValidUUID(input.nodeId)) {
    const { data, error } = await supabase
      .from("animation_captures")
      .upsert({
        user_id: userId,
        workflow_id: input.workflowId,
        node_id: input.nodeId,
        url,
        selector,
        duration,
        status: 'pending',
        animation_context: {},
        // Clear previous results on re-capture
        screenshot_before: null,
        screenshot_after: null,
        video_url: null,
        error_message: null,
      }, {
        onConflict: 'user_id,workflow_id,node_id',
        ignoreDuplicates: false,
      })
      .select("id")
      .single()

    if (error) {
      logger.error('Failed to upsert pending capture', {
        error: error.message,
        code: error.code,
        userId,
        workflowId: input.workflowId,
        nodeId: input.nodeId,
        url: input.url.slice(0, 100),
      })
      return null
    }

    return data.id
  }

  // Original insert behavior for captures without workflow context
  const { data, error } = await supabase
    .from("animation_captures")
    .insert({
      user_id: userId,
      url,
      selector,
      duration,
      status: 'pending',
      animation_context: {},
    })
    .select("id")
    .single()

  if (error) {
    logger.error('Failed to create pending capture', {
      error: error.message,
      code: error.code,
      userId,
      url: input.url.slice(0, 100),
    })
    return null
  }

  return data.id
}

/**
 * Update capture status (for job state transitions).
 * @param expectedCurrentStatus - If provided, only updates if current status matches (optimistic locking)
 */
export async function updateCaptureStatusServer(
  captureId: string,
  status: CaptureStatus,
  errorMessage?: string,
  expectedCurrentStatus?: CaptureStatus,
): Promise<boolean> {
  if (!isValidUUID(captureId)) {
    logger.warn('Invalid capture ID format', { captureId })
    return false
  }

  const supabase = createServerClient()

  let query = supabase
    .from("animation_captures")
    .update({
      status,
      error_message: errorMessage || null,
    })
    .eq("id", captureId)

  // Add optimistic locking if expected status provided
  if (expectedCurrentStatus) {
    query = query.eq("status", expectedCurrentStatus)
  }

  const { data, error } = await query.select("id")

  if (error) {
    logger.error('Failed to update status', {
      error: error.message,
      captureId,
      status,
      expectedCurrentStatus,
    })
    return false
  }

  // Verify a row was actually updated (record may have been deleted or status mismatch)
  if (!data || data.length === 0) {
    logger.warn('No rows updated (record may not exist or status mismatch)', {
      captureId,
      status,
      expectedCurrentStatus,
    })
    return false
  }

  return true
}

/**
 * Update capture with completed results.
 */
export async function updateCaptureWithResultServer(
  captureId: string,
  result: {
    pageTitle?: string
    replayUrl?: string
    sessionId?: string
    animationContext: AnimationContext
    screenshotBefore?: string
    screenshotAfter?: string
    videoUrl?: string
  },
): Promise<boolean> {
  if (!isValidUUID(captureId)) {
    logger.warn('Invalid capture ID format', { captureId })
    return false
  }

  const supabase = createServerClient()

  const { data, error } = await supabase
    .from("animation_captures")
    .update({
      status: 'completed',
      page_title: result.pageTitle?.slice(0, MAX_PAGE_TITLE_LENGTH),
      replay_url: result.replayUrl,
      session_id: result.sessionId,
      animation_context: result.animationContext,
      screenshot_before: result.screenshotBefore,
      screenshot_after: result.screenshotAfter,
      video_url: result.videoUrl?.slice(0, MAX_URL_LENGTH),
      error_message: null,
    })
    .eq("id", captureId)
    .select("id")

  if (error) {
    logger.error('Failed to update with result', {
      error: error.message,
      captureId,
    })
    return false
  }

  if (!data || data.length === 0) {
    logger.warn('No rows updated', { captureId })
    return false
  }

  return true
}

/**
 * Get an animation capture by ID (server-side, bypasses RLS).
 */
export async function getAnimationCaptureServer(
  captureId: string,
): Promise<AnimationCapture | null> {
  if (!isValidUUID(captureId)) {
    logger.warn('Invalid capture ID format', { captureId })
    return null
  }

  const supabase = createServerClient()

  const { data, error } = await supabase
    .from("animation_captures")
    .select("*")
    .eq("id", captureId)
    .single()

  if (error) {
    logger.error('Failed to fetch capture', {
      error: error.message,
      code: error.code,
      captureId,
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
    video_url: data.video_url,
    status: data.status as CaptureStatus,
    error_message: data.error_message,
    created_at: data.created_at,
    updated_at: data.updated_at,
  }
}

/**
 * Get an animation capture by ID.
 */
export async function getAnimationCapture(
  captureId: string,
): Promise<AnimationCapture | null> {
  if (!isValidUUID(captureId)) {
    logger.warn('Invalid capture ID format', { captureId })
    return null
  }

  const supabase = createClient()

  const { data, error } = await supabase
    .from("animation_captures")
    .select("*")
    .eq("id", captureId)
    .single()

  if (error) {
    logger.error('Failed to fetch capture', {
      error: error.message,
      code: error.code,
      captureId,
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
    video_url: data.video_url,
    status: data.status as CaptureStatus,
    error_message: data.error_message,
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
    .select("id, user_id, url, page_title, selector, duration, replay_url, session_id, status, error_message, created_at, updated_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1)

  if (error) {
    logger.error('Failed to fetch captures', {
      error: error.message,
      code: error.code,
      userId,
      limit,
      offset,
    })
    return []
  }

  return data || []
}

/**
 * Delete an animation capture (server-side).
 * Uses service role to bypass RLS but includes explicit ownership verification.
 * Should only be called from API routes after auth validation.
 */
export async function deleteAnimationCaptureServer(
  captureId: string,
  userId: string,
): Promise<boolean> {
  if (!isValidUUID(captureId)) {
    logger.warn('Invalid capture ID format', { captureId })
    return false
  }
  if (!isValidUUID(userId)) {
    logger.warn('Invalid user ID format in deleteAnimationCaptureServer', { userId })
    return false
  }

  const supabase = createServerClient()

  // Explicit ownership check (defense-in-depth)
  const { error } = await supabase
    .from("animation_captures")
    .delete()
    .eq("id", captureId)
    .eq("user_id", userId)

  if (error) {
    logger.error('Failed to delete capture', {
      error: error.message,
      code: error.code,
      captureId,
      userId,
    })
    return false
  }

  logger.info('Animation capture deleted', { captureId, userId })
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
      logger.error('Failed to check recent capture', {
        error: error.message,
        code: error.code,
        userId,
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
    video_url: data.video_url,
    status: data.status as CaptureStatus,
    error_message: data.error_message,
    created_at: data.created_at,
    updated_at: data.updated_at,
  }
}

// Staleness timeout in minutes
const STUCK_CAPTURE_TIMEOUT_MINUTES = 10

/**
 * Clean up stuck captures that have been in pending/processing state too long.
 * Returns the number of captures marked as failed.
 */
export async function cleanupStuckCapturesServer(): Promise<{
  cleaned: number
  errors: string[]
}> {
  const supabase = createServerClient()
  const errors: string[] = []

  const cutoffTime = new Date(Date.now() - STUCK_CAPTURE_TIMEOUT_MINUTES * 60 * 1000).toISOString()

  // Find stuck captures
  const { data: stuckCaptures, error: fetchError } = await supabase
    .from("animation_captures")
    .select("id, status, created_at")
    .in("status", ["pending", "processing"])
    .lt("created_at", cutoffTime)

  if (fetchError) {
    logger.error('Failed to fetch stuck captures', {
      error: fetchError.message,
    })
    return { cleaned: 0, errors: [fetchError.message] }
  }

  if (!stuckCaptures || stuckCaptures.length === 0) {
    return { cleaned: 0, errors: [] }
  }

  logger.info('Found stuck captures', {
    count: stuckCaptures.length,
    ids: stuckCaptures.map(c => c.id),
  })

  // Mark each as failed
  let cleaned = 0
  for (const capture of stuckCaptures) {
    const { data: updateData, error: updateError } = await supabase
      .from("animation_captures")
      .update({
        status: "failed",
        error_message: `Capture timed out after ${STUCK_CAPTURE_TIMEOUT_MINUTES} minutes`,
      })
      .eq("id", capture.id)
      .in("status", ["pending", "processing"]) // Only update if still stuck
      .select("id")

    if (updateError) {
      errors.push(`Failed to update ${capture.id}: ${updateError.message}`)
    } else if (updateData && updateData.length > 0) {
      cleaned++
    }
  }

  logger.info('Cleanup complete', {
    cleaned,
    errors: errors.length,
  })

  return { cleaned, errors }
}
