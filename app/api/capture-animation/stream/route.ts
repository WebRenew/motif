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
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'

// 5 minute timeout for long captures
export const maxDuration = 300

const bb = new Browserbase({
  apiKey: process.env.BROWSERBASE_API_KEY!,
})

// Extraction script to inject into the page
const extractionScript = `
(function(selector, duration) {
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
  // Check rate limit first
  const rateLimitResult = await checkRateLimit()
  if (!rateLimitResult.success) {
    const isConfigError = 'error' in rateLimitResult
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
    return new Response(
      JSON.stringify({ error: 'Invalid request body' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    )
  }

  const { url, selector: rawSelector, duration = 3000, userId } = body

  // Validate userId
  if (!userId || typeof userId !== 'string') {
    return new Response(
      JSON.stringify({ error: 'userId is required' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    )
  }

  // Validate URL
  const urlValidation = validateUrl(url)
  if (!urlValidation.valid) {
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
    return new Response(
      JSON.stringify({ error: 'Failed to create capture job' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }

  // Create temp directory for video
  const tempDir = path.join(os.tmpdir(), `capture-${captureId}`)
  fs.mkdirSync(tempDir, { recursive: true })

  // Return SSE stream
  const stream = new ReadableStream({
    async start(controller) {
      let browser: Awaited<ReturnType<typeof chromium.connectOverCDP>> | null = null
      let sessionId: string | null = null

      try {
        // Send initial connecting status
        sendEvent(controller, 'status', { status: 'connecting', captureId })
        await updateCaptureStatusServer(captureId, 'processing')

        // Create Browserbase session
        const session = await bb.sessions.create({
          projectId: process.env.BROWSERBASE_PROJECT_ID!,
        })
        sessionId = session.id

        // Send live status with session info
        const liveViewUrl = `https://www.browserbase.com/sessions/${session.id}`
        sendEvent(controller, 'status', {
          status: 'live',
          sessionId: session.id,
          liveViewUrl,
        })

        // Connect via Playwright with video recording
        browser = await chromium.connectOverCDP(session.connectUrl)
        const context = browser.contexts()[0]
        const page = context.pages()[0]

        // Navigate to URL
        sendEvent(controller, 'progress', { phase: 'loading', message: 'Loading page...' })
        await page.goto(url, { waitUntil: 'load', timeout: 60000 })
        await page.waitForTimeout(2000) // Let page settle

        // If selector provided, scroll to it
        if (selector) {
          try {
            await page.locator(selector).scrollIntoViewIfNeeded()
            await page.waitForTimeout(500)
          } catch {
            console.warn('[capture-stream] Could not scroll to selector:', selector)
          }
        }

        // Start capture phase
        sendEvent(controller, 'status', { status: 'capturing' })

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

        // Extract animation context
        sendEvent(controller, 'progress', { phase: 'extracting', message: 'Extracting animation data...' })
        const animationContext = await page.evaluate(
          `(${extractionScript})('${selector || ''}', ${captureDuration})`
        ) as AnimationContext

        // Get page title
        const pageTitle = await page.title()

        // Take a screenshot as video thumbnail (temporary until we have real video)
        const screenshot = await page.screenshot({ type: 'jpeg', quality: 80 })

        // Close browser
        await page.close()
        await browser.close()
        browser = null

        // Upload video/screenshot to Supabase
        sendEvent(controller, 'progress', { phase: 'uploading', message: 'Uploading capture...' })
        
        // For now, upload screenshot as placeholder - real video would come from Browserbase recording
        const videoUrl = await uploadVideoServer(userId, captureId, screenshot, 'capture.jpg')

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

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        console.error('[capture-stream] Capture failed:', {
          captureId,
          error: errorMessage,
          timestamp: new Date().toISOString(),
        })

        // Clean up browser if still open
        if (browser) {
          try {
            await browser.close()
          } catch {
            // Ignore cleanup errors
          }
        }

        // Provide user-friendly error messages
        let userMessage = 'Animation capture failed'
        let errorCode = 'CAPTURE_ERROR'
        
        if (errorMessage.includes('timeout') || errorMessage.includes('Timeout')) {
          userMessage = 'Page took too long to load. Please try a different URL.'
          errorCode = 'TIMEOUT'
        } else if (errorMessage.includes('net::ERR_') || errorMessage.includes('Navigation')) {
          userMessage = 'Could not load the page. Please check the URL and try again.'
          errorCode = 'PAGE_LOAD_ERROR'
        } else if (errorMessage.includes('Browserbase') || errorMessage.includes('session')) {
          userMessage = 'Browser automation service error. Please try again.'
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
