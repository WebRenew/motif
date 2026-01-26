/**
 * Simplified Animation Capture API
 *
 * Uses Browserbase CDP for fast screenshots every 0.5s.
 * No workflow complexity - just serverless with fluid compute (300s max).
 * Stores individual frames instead of stitched strips.
 */

import { NextRequest, NextResponse } from 'next/server'
import { chromium } from 'playwright-core'
import Browserbase from '@browserbasehq/sdk'
import { uploadFrameServer } from '@/lib/supabase/capture-frames'
import { checkRateLimit } from '@/lib/rate-limit'
import { isUserAnonymousServer } from '@/lib/supabase/auth'
import { isValidUUID } from '@/lib/utils'
import { createLogger, generateRequestId, startTimer } from '@/lib/logger'

const log = createLogger('capture-frames')

// Fluid compute - 300s max timeout
export const maxDuration = 300

// Constants
const FRAME_INTERVAL_MS = 500  // 0.5 seconds between frames
const MAX_FRAMES = 10
const MAX_DURATION_S = 5

interface CaptureRequest {
  url: string
  selector?: string
  duration: number  // seconds (1-5)
  userId: string
}

interface CaptureResponse {
  success: boolean
  frameUrls?: string[]
  animationContext?: {
    libraries?: Record<string, boolean>
    keyframes?: Record<string, Array<{ offset: string; styles: string }>>
    computedStyles?: Record<string, string>
    html?: string
    boundingBox?: { x: number; y: number; width: number; height: number }
  }
  pageTitle?: string
  error?: string
}

/**
 * Validates URL format
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
 * Validates and sanitizes CSS selector
 */
function validateSelector(selector: string | undefined): string | undefined {
  if (!selector) return undefined
  if (selector.length > 200) throw new Error('Selector too long')
  if (!/^[a-zA-Z0-9_\-#.\[\]="':,\s()>+~*^$|]+$/.test(selector)) {
    throw new Error('Invalid characters in selector')
  }
  return selector
}

export async function POST(request: NextRequest) {
  const requestId = generateRequestId()
  const timer = startTimer()

  try {
    log.info('Capture request received', { requestId })

    // Check Browserbase config
    if (!process.env.BROWSERBASE_API_KEY || !process.env.BROWSERBASE_PROJECT_ID) {
      return NextResponse.json<CaptureResponse>(
        { success: false, error: 'Animation capture service not configured' },
        { status: 503 }
      )
    }

    // Parse request
    let body: CaptureRequest
    try {
      body = await request.json()
    } catch {
      return NextResponse.json<CaptureResponse>(
        { success: false, error: 'Invalid request body' },
        { status: 400 }
      )
    }

    const { url, selector: rawSelector, duration: rawDuration, userId } = body

    // Validate userId
    if (!userId || !isValidUUID(userId)) {
      return NextResponse.json<CaptureResponse>(
        { success: false, error: 'Valid userId is required' },
        { status: 400 }
      )
    }

    // Check authentication (no anonymous users)
    const isAnonymous = await isUserAnonymousServer(userId)
    if (isAnonymous === null) {
      return NextResponse.json<CaptureResponse>(
        { success: false, error: 'User not found' },
        { status: 401 }
      )
    }
    if (isAnonymous) {
      return NextResponse.json<CaptureResponse>(
        { success: false, error: 'Sign in required for animation capture' },
        { status: 403 }
      )
    }

    // Rate limit check
    const rateLimitResult = await checkRateLimit()
    if (!rateLimitResult.success) {
      return NextResponse.json<CaptureResponse>(
        { success: false, error: 'Rate limit exceeded' },
        { status: 429 }
      )
    }

    // Validate URL
    const urlValidation = validateUrl(url)
    if (!urlValidation.valid) {
      return NextResponse.json<CaptureResponse>(
        { success: false, error: urlValidation.error },
        { status: 400 }
      )
    }

    // Validate selector
    let selector: string | undefined
    try {
      selector = validateSelector(rawSelector)
    } catch (err) {
      return NextResponse.json<CaptureResponse>(
        { success: false, error: err instanceof Error ? err.message : 'Invalid selector' },
        { status: 400 }
      )
    }

    // Validate and cap duration (1-5 seconds)
    const duration = Math.min(Math.max(Number(rawDuration) || 3, 1), MAX_DURATION_S)
    const frameCount = Math.min(Math.ceil(duration / 0.5), MAX_FRAMES)

    log.info('Starting capture', {
      requestId,
      url: url.slice(0, 50),
      duration,
      frameCount,
      hasSelector: !!selector,
    })

    // Create Browserbase session
    const bb = new Browserbase({ apiKey: process.env.BROWSERBASE_API_KEY })
    const session = await bb.sessions.create({
      projectId: process.env.BROWSERBASE_PROJECT_ID,
    })

    log.info('Session created', { requestId, sessionId: session.id })

    // Connect via CDP
    const browser = await chromium.connectOverCDP(session.connectUrl)
    const context = browser.contexts()[0]
    const page = context.pages()[0]

    try {
      // Navigate to URL
      await page.goto(url, { waitUntil: 'load', timeout: 60000 })

      // Hide scrollbars for cleaner capture
      await page.evaluate(() => {
        const style = document.createElement('style')
        style.textContent = '::-webkit-scrollbar { display: none; } * { scrollbar-width: none; }'
        document.head.appendChild(style)
      })

      // Wait for page to settle
      await page.waitForTimeout(1500)

      // Scroll to selector if provided
      if (selector) {
        try {
          await page.locator(selector).scrollIntoViewIfNeeded()
          await page.waitForTimeout(500)
        } catch {
          log.warn('Could not scroll to selector', { requestId, selector })
        }
      }

      // Create CDP session for fast screenshots
      const cdpSession = await context.newCDPSession(page)

      // Capture frames
      const frames: Buffer[] = []
      for (let i = 0; i < frameCount; i++) {
        const { data } = await cdpSession.send('Page.captureScreenshot', {
          format: 'jpeg',
          quality: 85,
        })
        frames.push(Buffer.from(data, 'base64'))

        // Wait for next frame (except after last)
        if (i < frameCount - 1) {
          await page.waitForTimeout(FRAME_INTERVAL_MS)
        }
      }

      log.info('Frames captured', { requestId, count: frames.length })

      // Extract animation context (metadata only, not visual data)
      const animationContext = await page.evaluate((sel: string) => {
        const element = sel ? document.querySelector(sel) : document.body
        if (!element) return { error: 'Element not found' }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const win = window as any
        const libraries = {
          gsap: typeof win.gsap !== 'undefined',
          framerMotion: !!document.querySelector('[data-framer-component-type]'),
          animejs: typeof win.anime !== 'undefined',
          threejs: typeof win.THREE !== 'undefined',
          lottie: typeof win.lottie !== 'undefined',
        }

        // Extract CSS keyframes
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const keyframesData: Record<string, any[]> = {}
        for (const sheet of document.styleSheets) {
          try {
            for (const rule of sheet.cssRules) {
              if (rule instanceof CSSKeyframesRule) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                keyframesData[rule.name] = Array.from(rule.cssRules).map((kf: any) => ({
                  offset: kf.keyText,
                  styles: kf.style.cssText,
                }))
              }
            }
          } catch { /* CORS */ }
        }

        const el = element as Element
        const styles = getComputedStyle(el)

        return {
          libraries,
          keyframes: keyframesData,
          computedStyles: {
            animation: styles.animation,
            transition: styles.transition,
            willChange: styles.willChange,
          },
          html: el.outerHTML.slice(0, 5000),
          boundingBox: el.getBoundingClientRect(),
        }
      }, selector || '')

      const pageTitle = await page.title()

      // Close browser
      await page.close()
      await browser.close()

      // Release Browserbase session
      try {
        await bb.sessions.update(session.id, {
          projectId: process.env.BROWSERBASE_PROJECT_ID!,
          status: 'REQUEST_RELEASE',
        })
      } catch {
        log.warn('Failed to release session', { requestId, sessionId: session.id })
      }

      // Upload frames individually
      const frameUrls: string[] = []
      const captureId = `capture-${Date.now()}`

      for (let i = 0; i < frames.length; i++) {
        const frameUrl = await uploadFrameServer(userId, captureId, i, frames[i])
        if (frameUrl) {
          frameUrls.push(frameUrl)
        }
      }

      log.info('Capture complete', {
        requestId,
        frameCount: frameUrls.length,
        durationMs: timer.elapsed(),
      })

      return NextResponse.json<CaptureResponse>({
        success: true,
        frameUrls,
        animationContext: animationContext as CaptureResponse['animationContext'],
        pageTitle,
      })

    } catch (error) {
      // Ensure cleanup on error
      try {
        await browser.close()
        await bb.sessions.update(session.id, {
          projectId: process.env.BROWSERBASE_PROJECT_ID!,
          status: 'REQUEST_RELEASE',
        })
      } catch { /* ignore cleanup errors */ }

      throw error
    }

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error'
    log.error('Capture failed', { requestId, error: errorMsg, durationMs: timer.elapsed() })

    return NextResponse.json<CaptureResponse>(
      { success: false, error: `Capture failed: ${errorMsg}` },
      { status: 500 }
    )
  }
}
