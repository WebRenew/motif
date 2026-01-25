import { NextRequest } from 'next/server'
import { chromium } from 'playwright-core'
import Browserbase from '@browserbasehq/sdk'
import { checkRateLimit } from '@/lib/rate-limit'
import { uploadVideoServer } from '@/lib/supabase/capture-videos'
import {
  createPendingCaptureServer,
  updateCaptureStatusServer,
  updateCaptureWithResultServer,
  type AnimationContext,
} from '@/lib/supabase/animation-captures'
import { isUserAnonymousServer } from '@/lib/supabase/auth'
import { isValidUUID } from '@/lib/utils'
import { createLogger, startTimer, generateRequestId } from '@/lib/logger'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'

const log = createLogger('capture-stream')

// 5 minute timeout for long captures
export const maxDuration = 300

const bb = new Browserbase({
  apiKey: process.env.BROWSERBASE_API_KEY!,
})

// Extraction script to inject into the page
// Uses args array pattern to prevent selector injection vulnerabilities
const extractionScript = `
(function(args) {
  const selector = args[0];
  const duration = args[1];
  const element = selector ? document.querySelector(selector) : document.body;
  if (!element) return { error: 'Element not found' };
  
  // Detect animation libraries
  const libraries = {
    gsap: typeof window.gsap !== 'undefined',
    framerMotion: !!document.querySelector('[data-framer-component-type]'),
    animejs: typeof window.anime !== 'undefined',
    threejs: typeof window.THREE !== 'undefined',
    lottie: typeof window.lottie !== 'undefined',
  };
  
  // Extract CSS keyframes
  const keyframes = {};
  for (const sheet of document.styleSheets) {
    try {
      for (const rule of sheet.cssRules) {
        if (rule instanceof CSSKeyframesRule) {
          keyframes[rule.name] = Array.from(rule.cssRules).map(kf => ({
            offset: kf.keyText,
            styles: kf.style.cssText,
          }));
        }
      }
    } catch (e) { /* CORS */ }
  }
  
  // Capture frames over time
  return new Promise((resolve) => {
    const frames = [];
    const startTime = performance.now();
    const props = ['transform', 'opacity', 'width', 'height', 'left', 'top', 
                   'backgroundColor', 'scale', 'rotate', 'translateX', 'translateY'];
    
    function capture() {
      const elapsed = performance.now() - startTime;
      const styles = getComputedStyle(element);
      
      const frame = { timestamp: Math.round(elapsed) };
      props.forEach(p => frame[p] = styles[p]);
      frames.push(frame);
      
      if (elapsed < duration) {
        requestAnimationFrame(capture);
      } else {
        resolve({
          frames,
          keyframes,
          libraries,
          computedStyles: {
            animation: styles.animation,
            transition: styles.transition,
            willChange: styles.willChange,
          },
          html: element.outerHTML.slice(0, 5000),
          boundingBox: element.getBoundingClientRect(),
        });
      }
    }
    requestAnimationFrame(capture);
  });
})
`

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

/**
 * Send SSE event
 */
function sendEvent(controller: ReadableStreamDefaultController, event: string, data: object) {
  const encoder = new TextEncoder()
  controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`))
}

export async function POST(request: NextRequest) {
  const requestId = generateRequestId()
  const _totalTimer = startTimer() // Reserved for future response timing
  
  log.info('Capture request received', { requestId })

  // Check rate limit first
  const rateLimitResult = await checkRateLimit()
  if (!rateLimitResult.success) {
    const isConfigError = 'error' in rateLimitResult
    log.warn('Rate limit check failed', { requestId, isConfigError })
    return new Response(
      JSON.stringify({
        error: isConfigError
          ? 'Service temporarily unavailable'
          : 'Rate limit exceeded. Try again later.',
      }),
      {
        status: isConfigError ? 503 : 429,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  }

  // Check for required environment variables
  if (!process.env.BROWSERBASE_API_KEY || !process.env.BROWSERBASE_PROJECT_ID) {
    log.error('Missing Browserbase configuration', { requestId })
    return new Response(
      JSON.stringify({ error: 'Animation capture service not configured' }),
      { status: 503, headers: { 'Content-Type': 'application/json' } }
    )
  }

  let body: {
    url: string
    selector?: string
    duration?: number
    userId: string
  }

  try {
    body = await request.json()
  } catch {
    log.warn('Invalid request body', { requestId })
    return new Response(
      JSON.stringify({ error: 'Invalid request body' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    )
  }

  const { url, selector: rawSelector, duration = 3000, userId } = body
  
  log.info('Capture request parsed', { 
    requestId, 
    userId: userId?.slice(0, 8) + '...', 
    url: url?.slice(0, 50),
    hasSelector: !!rawSelector,
    duration,
  })

  // Validate userId (must be valid UUID)
  if (!userId || typeof userId !== 'string' || !isValidUUID(userId)) {
    log.warn('Invalid userId', { requestId })
    return new Response(
      JSON.stringify({ error: 'Valid userId is required' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    )
  }

  // Check if user is anonymous - this feature requires authentication
  const isAnonymous = await isUserAnonymousServer(userId)
  if (isAnonymous === null) {
    log.warn('User not found', { requestId, userId: userId.slice(0, 8) + '...' })
    return new Response(
      JSON.stringify({ error: 'User not found' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    )
  }
  if (isAnonymous) {
    log.warn('Anonymous user blocked', { requestId })
    return new Response(
      JSON.stringify({ error: 'Authentication required. Please sign in to use animation capture.' }),
      { status: 403, headers: { 'Content-Type': 'application/json' } }
    )
  }

  // Validate URL
  const urlValidation = validateUrl(url)
  if (!urlValidation.valid) {
    log.warn('Invalid URL', { requestId, error: urlValidation.error })
    return new Response(
      JSON.stringify({ error: urlValidation.error }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    )
  }

  // Validate selector
  let selector: string | undefined
  try {
    selector = validateSelector(rawSelector)
  } catch (selectorError) {
    log.warn('Invalid selector', { requestId, error: selectorError instanceof Error ? selectorError.message : 'Invalid' })
    return new Response(
      JSON.stringify({ error: selectorError instanceof Error ? selectorError.message : 'Invalid selector' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
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
    log.error('Failed to create capture record', { requestId, userId: userId.slice(0, 8) + '...' })
    return new Response(
      JSON.stringify({ error: 'Failed to create capture job' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
  
  log.info('Capture record created', { requestId, captureId })

  // Create temp directory for video
  const tempDir = path.join(os.tmpdir(), `capture-${captureId}`)
  fs.mkdirSync(tempDir, { recursive: true })

  // Return SSE stream
  const stream = new ReadableStream({
    async start(controller) {
      let browser: Awaited<ReturnType<typeof chromium.connectOverCDP>> | null = null
      let sessionId: string | null = null
      const streamTimer = startTimer()
      
      // Phase timers for detailed metrics
      const metrics: Record<string, number> = {}

      try {
        // Send initial connecting status
        sendEvent(controller, 'status', { status: 'connecting', captureId })
        log.info('Starting capture stream', { requestId, captureId })
        
        // Mark as processing with optimistic locking - only proceeds if currently "pending"
        const statusUpdated = await updateCaptureStatusServer(captureId, 'processing', undefined, 'pending')
        if (!statusUpdated) {
          log.warn('Capture already processing', { requestId, captureId })
          sendEvent(controller, 'error', {
            message: 'Capture already being processed or was deleted',
            code: 'ALREADY_PROCESSING',
            captureId,
          })
          controller.close()
          return
        }

        // Create Browserbase session
        const sessionTimer = startTimer()
        const session = await bb.sessions.create({
          projectId: process.env.BROWSERBASE_PROJECT_ID!,
        })
        sessionId = session.id
        metrics.sessionCreate = sessionTimer.elapsed()
        log.info('Browserbase session created', { requestId, captureId, sessionId, durationMs: metrics.sessionCreate })

        // Send initial live status immediately (without liveViewUrl yet)
        sendEvent(controller, 'status', {
          status: 'live',
          sessionId: session.id,
        })

        // Fetch debug URL and connect to browser in parallel to reduce latency
        const connectTimer = startTimer()
        const [debugInfo, browserConnection] = await Promise.all([
          bb.sessions.debug(session.id),
          chromium.connectOverCDP(session.connectUrl),
        ])
        browser = browserConnection
        metrics.browserConnect = connectTimer.elapsed()
        log.info('Browser connected', { requestId, captureId, sessionId, durationMs: metrics.browserConnect })

        // Send liveViewUrl once available
        const liveViewUrl = debugInfo.debuggerFullscreenUrl
        sendEvent(controller, 'status', {
          status: 'live',
          sessionId: session.id,
          liveViewUrl,
        })

        const context = browser.contexts()[0]
        if (!context) {
          throw new Error('No browser context available')
        }
        const page = context.pages()[0]
        if (!page) {
          throw new Error('No page available in browser context')
        }

        // Navigate to URL
        const navTimer = startTimer()
        sendEvent(controller, 'progress', { phase: 'loading', message: 'Loading page...' })
        await page.goto(url, { waitUntil: 'load', timeout: 60000 })
        await page.waitForTimeout(2000) // Let page settle
        metrics.pageLoad = navTimer.elapsed()
        log.info('Page loaded', { requestId, captureId, url: url.slice(0, 50), durationMs: metrics.pageLoad })

        // If selector provided, scroll to it
        if (selector) {
          try {
            await page.locator(selector).scrollIntoViewIfNeeded()
            await page.waitForTimeout(500)
          } catch {
            log.warn('Could not scroll to selector', { requestId, captureId, selector })
          }
        }

        // Start capture phase
        sendEvent(controller, 'status', { status: 'capturing' })
        const captureTimer = startTimer()

        const totalFrames = 30
        const frameInterval = captureDuration / totalFrames
        const startTime = Date.now()

        // Send progress updates during capture
        for (let frame = 1; frame <= totalFrames; frame++) {
          const elapsed = Date.now() - startTime
          sendEvent(controller, 'progress', {
            frame,
            total: totalFrames,
            elapsed: Math.round(elapsed),
            duration: captureDuration,
            percent: Math.round((frame / totalFrames) * 100),
          })
          await page.waitForTimeout(frameInterval)
        }
        metrics.capture = captureTimer.elapsed()

        // Extract animation context
        const extractTimer = startTimer()
        sendEvent(controller, 'progress', { phase: 'extracting', message: 'Extracting animation data...' })
        const animationContext = await page.evaluate(
          `${extractionScript}(arguments[0])`,
          [selector || '', captureDuration]
        ) as AnimationContext
        metrics.extraction = extractTimer.elapsed()
        
        const framesExtracted = animationContext?.frames?.length || 0
        log.info('Animation extracted', { requestId, captureId, framesExtracted, durationMs: metrics.extraction })

        // Get page title
        const pageTitle = await page.title()

        // Take a screenshot as video thumbnail (temporary until we have real video)
        const screenshot = await page.screenshot({ type: 'jpeg', quality: 80 })
        const screenshotSize = screenshot.length

        // Close browser
        await page.close()
        await browser.close()
        browser = null
        log.info('Browser closed', { requestId, captureId, sessionId })

        // Upload video/screenshot to Supabase
        const uploadTimer = startTimer()
        sendEvent(controller, 'progress', { phase: 'uploading', message: 'Uploading capture...' })
        
        // For now, upload screenshot as placeholder - real video would come from Browserbase recording
        const videoUrl = await uploadVideoServer(userId, captureId, screenshot, 'capture.jpg')
        metrics.upload = uploadTimer.elapsed()
        log.info('Screenshot uploaded', { requestId, captureId, screenshotSize, durationMs: metrics.upload })

        // Session replay URL
        const replayUrl = `https://browserbase.com/sessions/${sessionId}`

        // Update database with results
        await updateCaptureWithResultServer(captureId, {
          pageTitle,
          replayUrl,
          sessionId,
          animationContext,
          videoUrl: videoUrl || undefined,
        })

        // Send complete event
        sendEvent(controller, 'complete', {
          captureId,
          videoUrl,
          replayUrl,
          animationContext,
          pageTitle,
        })

        // Clean up temp directory
        fs.rmSync(tempDir, { recursive: true, force: true })
        
        // Log completion with full metrics
        log.info('Capture completed successfully', {
          requestId,
          captureId,
          sessionId,
          totalDurationMs: streamTimer.elapsed(),
          metrics,
          framesExtracted,
          pageTitle: pageTitle?.slice(0, 50),
        })

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        const errorStack = error instanceof Error ? error.stack : undefined
        
        log.error('Capture failed', {
          requestId,
          captureId,
          sessionId,
          error: errorMessage,
          stack: errorStack?.split('\n').slice(0, 5).join('\n'), // First 5 lines of stack
          durationMs: streamTimer.elapsed(),
          metrics,
        })

        // Clean up browser if still open
        if (browser) {
          try {
            await browser.close()
            log.info('Browser cleaned up after error', { requestId, captureId, sessionId })
          } catch (cleanupError) {
            log.warn('Failed to cleanup browser', { requestId, captureId, error: String(cleanupError) })
          }
        }

        // Release Browserbase session to free resources
        if (sessionId) {
          try {
            await bb.sessions.update(sessionId, {
              projectId: process.env.BROWSERBASE_PROJECT_ID!,
              status: 'REQUEST_RELEASE',
            })
            log.info('Browserbase session released', { requestId, captureId, sessionId })
          } catch (releaseError) {
            log.warn('Failed to release Browserbase session', { requestId, captureId, sessionId, error: String(releaseError) })
          }
        }

        // Provide user-friendly error messages while preserving details for debugging
        let userMessage = `Animation capture failed: ${errorMessage.slice(0, 100)}`
        let errorCode = 'CAPTURE_ERROR'
        
        if (errorMessage.includes('timeout') || errorMessage.includes('Timeout')) {
          userMessage = 'Page took too long to load. Please try a different URL.'
          errorCode = 'TIMEOUT'
        } else if (errorMessage.includes('net::ERR_') || errorMessage.includes('Navigation')) {
          userMessage = `Could not load the page: ${errorMessage.slice(0, 80)}`
          errorCode = 'PAGE_LOAD_ERROR'
        } else if (errorMessage.includes('Browserbase') || errorMessage.includes('session')) {
          userMessage = `Browser automation error: ${errorMessage.slice(0, 80)}`
          errorCode = 'BROWSERBASE_ERROR'
        }

        // Update database with error
        await updateCaptureStatusServer(captureId, 'failed', userMessage)

        // Send error event
        sendEvent(controller, 'error', {
          message: userMessage,
          code: errorCode,
          captureId,
        })

        // Clean up temp directory
        try {
          fs.rmSync(tempDir, { recursive: true, force: true })
        } catch {
          // Ignore cleanup errors
        }
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
}
