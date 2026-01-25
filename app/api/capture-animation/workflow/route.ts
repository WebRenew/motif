/**
 * Animation Capture Workflow Trigger
 * 
 * This endpoint starts a durable workflow for animation capture.
 * Unlike the streaming endpoint, this returns immediately and processes in the background.
 */

import { NextRequest, NextResponse } from 'next/server'
import { start } from 'workflow/api'
import { checkRateLimit } from '@/lib/rate-limit'
import { createPendingCaptureServer } from '@/lib/supabase/animation-captures'
import { isUserAnonymousServer } from '@/lib/supabase/auth'
import { isValidUUID } from '@/lib/utils'
import { createLogger, generateRequestId } from '@/lib/logger'
import { captureAnimationWorkflow } from '@/workflows/capture-animation'

const log = createLogger('capture-workflow-trigger')

// 5 minute timeout
export const maxDuration = 300

/**
 * Validates URL to ensure it's a valid HTTP(S) URL
 */
function validateUrl(url: string): { valid: boolean; error?: string } {
  if (!url || typeof url !== 'string') {
    return { valid: false, error: 'URL is required' }
  }

  try {
    const parsed = new URL(url)
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return { valid: false, error: 'URL must use http or https protocol' }
    }
    return { valid: true }
  } catch {
    return { valid: false, error: 'Invalid URL format' }
  }
}

/**
 * Validates CSS selector for safety
 */
function validateSelector(selector: string | undefined): string | undefined {
  if (!selector) return undefined
  
  if (selector.length > 200) {
    throw new Error('Selector too long')
  }
  
  if (!/^[a-zA-Z0-9_\-#.\[\]="':,\s()>+~*^$|]+$/.test(selector)) {
    throw new Error('Invalid characters in selector')
  }
  
  return selector
}

export async function POST(request: NextRequest) {
  const requestId = generateRequestId()
  
  log.info('Workflow trigger received', { requestId })

  // Check rate limit
  const rateLimitResult = await checkRateLimit()
  if (!rateLimitResult.success) {
    const isConfigError = 'error' in rateLimitResult
    log.warn('Rate limit failed', { requestId, isConfigError })
    return NextResponse.json(
      { error: isConfigError ? 'Service temporarily unavailable' : 'Rate limit exceeded' },
      { status: isConfigError ? 503 : 429 }
    )
  }

  // Check Browserbase config
  if (!process.env.BROWSERBASE_API_KEY || !process.env.BROWSERBASE_PROJECT_ID) {
    log.error('Missing Browserbase config', { requestId })
    return NextResponse.json(
      { error: 'Animation capture service not configured' },
      { status: 503 }
    )
  }

  // Parse request
  let body: {
    url: string
    selector?: string
    duration?: number
    userId: string
  }

  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { url, selector: rawSelector, duration = 3000, userId } = body

  // Validate userId
  if (!userId || typeof userId !== 'string' || !isValidUUID(userId)) {
    return NextResponse.json({ error: 'Valid userId is required' }, { status: 400 })
  }

  // Check authentication
  const isAnonymous = await isUserAnonymousServer(userId)
  if (isAnonymous === null) {
    return NextResponse.json({ error: 'User not found' }, { status: 401 })
  }
  if (isAnonymous) {
    return NextResponse.json(
      { error: 'Authentication required. Please sign in to use animation capture.' },
      { status: 403 }
    )
  }

  // Validate URL
  const urlValidation = validateUrl(url)
  if (!urlValidation.valid) {
    return NextResponse.json({ error: urlValidation.error }, { status: 400 })
  }

  // Validate selector
  let selector: string | undefined
  try {
    selector = validateSelector(rawSelector)
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Invalid selector' },
      { status: 400 }
    )
  }

  // Validate duration (1-10 seconds)
  const captureDuration = Math.min(Math.max(Number(duration) || 3000, 1000), 10000)

  // Create pending capture record
  const captureId = await createPendingCaptureServer(userId, {
    url,
    selector,
    duration: captureDuration,
  })

  if (!captureId) {
    log.error('Failed to create capture record', { requestId })
    return NextResponse.json({ error: 'Failed to create capture job' }, { status: 500 })
  }

  log.info('Starting workflow', { requestId, captureId, url: url.slice(0, 50) })

  // Start the workflow - returns a run handle for tracking
  const run = await start(captureAnimationWorkflow, [{
    captureId,
    userId,
    url,
    selector,
    duration: captureDuration,
  }])

  log.info('Workflow started', { requestId, captureId, runId: run.runId })

  // Return the workflow's readable stream as SSE
  // This streams events to the client as the workflow progresses
  const readable = run.readable
  
  // Transform the workflow stream to SSE format
  const sseStream = new ReadableStream({
    async start(controller) {
      const reader = readable.getReader()
      const encoder = new TextEncoder()
      
      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          
          // Format as SSE: event: type\ndata: json\n\n
          const event = value as { type: string; [key: string]: unknown }
          const sseMessage = `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`
          controller.enqueue(encoder.encode(sseMessage))
        }
      } catch (error) {
        log.error('Stream error', { requestId, captureId, error: String(error) })
      } finally {
        controller.close()
      }
    }
  })

  return new Response(sseStream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
}
