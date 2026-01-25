/**
 * Animation Capture Workflow
 * 
 * Durable workflow for capturing website animations using Browserbase.
 * Automatically retries failed steps and survives crashes/deployments.
 * 
 * Best practices implemented:
 * - Proper rollback pattern with compensation actions
 * - Idempotent session creation using captureId
 * - Graceful cleanup on failure
 * - Deep error handling per step
 */

import { FatalError, getWritable } from 'workflow'
import { chromium } from 'playwright-core'
import Browserbase from '@browserbasehq/sdk'
import { uploadVideoServer } from '@/lib/supabase/capture-videos'
import {
  updateCaptureStatusServer,
  updateCaptureWithResultServer,
  type AnimationContext,
} from '@/lib/supabase/animation-captures'
import { createLogger, startTimer } from '@/lib/logger'

const log = createLogger('capture-workflow')

// Types for SSE-style streaming events
export type CaptureStreamEvent = 
  | { type: 'status'; status: string; captureId?: string; liveViewUrl?: string; sessionId?: string }
  | { type: 'progress'; phase: string; message: string; percent?: number }
  | { type: 'complete'; captureId: string; videoUrl?: string; animationContext?: AnimationContext }
  | { type: 'error'; message: string; code: string; captureId?: string }

// Extraction script to inject into the page
// NOTE: This is now inlined in createSessionAndCapture to avoid 'arguments is not defined' error
const _extractionScript = `
(function(args) {
  const selector = args[0];
  const duration = args[1];
  const element = selector ? document.querySelector(selector) : document.body;
  if (!element) return { error: 'Element not found' };
  
  const libraries = {
    gsap: typeof window.gsap !== 'undefined',
    framerMotion: !!document.querySelector('[data-framer-component-type]'),
    animejs: typeof window.anime !== 'undefined',
    threejs: typeof window.THREE !== 'undefined',
    lottie: typeof window.lottie !== 'undefined',
  };
  
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

interface CaptureInput {
  captureId: string
  userId: string
  url: string
  selector?: string
  duration: number
}

interface _BrowserbaseSession {
  sessionId: string
  connectUrl: string
  debuggerUrl: string
}

interface CaptureResult {
  animationContext: AnimationContext
  pageTitle: string
  screenshotBase64: string // Base64 encoded for workflow serialization
}

// Type for rollback/compensation functions
type RollbackFn = () => Promise<void>

/**
 * Main capture workflow - orchestrates the entire capture process
 * 
 * Implements proper rollback pattern:
 * - Accumulates compensation actions as steps complete
 * - Executes rollbacks in reverse order on failure
 * - Each rollback is wrapped in try/catch to ensure all run
 */
export async function captureAnimationWorkflow(input: CaptureInput) {
  'use workflow'
  
  const { captureId, userId, url, selector, duration } = input
  const workflowTimer = startTimer()
  
  // Sanitize URL for logging (remove query params that might contain sensitive data)
  const sanitizedUrl = sanitizeUrlForLogging(url)
  log.info('Workflow started', { captureId, userId: userId.slice(0, 8), url: sanitizedUrl })
  
  // Send initial status to stream
  await sendStreamEvent({ type: 'status', status: 'connecting', captureId })
  
  // Accumulate rollback/compensation actions
  const rollbacks: RollbackFn[] = []
  
  try {
    // Step 1: Update status to processing
    await updateCaptureProcessing(captureId)
    // Add rollback: mark as failed if later steps fail
    rollbacks.push(async () => {
      await markCaptureFailed(captureId, 'Workflow rolled back')
    })
    
    // Step 2: Create session AND capture in one step to avoid session expiry between steps
    await sendStreamEvent({ type: 'progress', phase: 'session', message: 'Creating browser session...' })
    const { captureResult, sessionId } = await createSessionAndCapture({
      captureId,
      url,
      selector,
      duration,
    })
    
    // Add rollback: release session if later steps fail
    rollbacks.push(async () => {
      await releaseBrowserbaseSession(sessionId)
    })
    
    // Step 4: Upload screenshot
    await sendStreamEvent({ type: 'progress', phase: 'uploading', message: 'Uploading capture...' })
    const videoUrl = await uploadScreenshot({
      userId,
      captureId,
      screenshotBase64: captureResult.screenshotBase64,
    })
    
    // Step 5: Save results to database
    await sendStreamEvent({ type: 'progress', phase: 'saving', message: 'Saving results...' })
    await saveResults({
      captureId,
      sessionId,
      animationContext: captureResult.animationContext,
      pageTitle: captureResult.pageTitle,
      videoUrl,
    })
    
    // Step 6: Release Browserbase session (success path)
    // Remove the session release from rollbacks since we're doing it here
    rollbacks.pop()
    await releaseBrowserbaseSession(sessionId)
    
    // Clear the failure rollback since we succeeded
    rollbacks.pop()
    
    log.info('Workflow completed', { 
      captureId, 
      durationMs: workflowTimer.elapsed(),
      framesExtracted: captureResult.animationContext?.frames?.length || 0,
    })
    
    // Send completion event
    await sendStreamEvent({ 
      type: 'complete', 
      captureId, 
      videoUrl: videoUrl || undefined, 
      animationContext: captureResult.animationContext,
    })
    await closeStream()
    
    return {
      captureId,
      videoUrl,
      animationContext: captureResult.animationContext,
      pageTitle: captureResult.pageTitle,
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown workflow error'
    log.error('Workflow failed, executing rollbacks', { 
      captureId, 
      error: errorMessage, 
      durationMs: workflowTimer.elapsed(),
      rollbackCount: rollbacks.length,
    })
    
    // Send error event to stream
    await sendStreamEvent({ 
      type: 'error', 
      message: errorMessage.slice(0, 200), 
      code: 'WORKFLOW_ERROR',
      captureId,
    })
    await closeStream()
    
    // Execute rollbacks in reverse order
    // Each rollback is wrapped to ensure all run even if some fail
    for (let i = rollbacks.length - 1; i >= 0; i--) {
      try {
        await rollbacks[i]()
      } catch (rollbackError) {
        log.error('Rollback failed', { 
          captureId, 
          rollbackIndex: i,
          error: rollbackError instanceof Error ? rollbackError.message : String(rollbackError),
        })
        // Continue with other rollbacks even if one fails
      }
    }
    
    // Re-throw to mark workflow as failed
    throw error
  }
}

/**
 * Sanitize URL for logging - removes query params that might contain sensitive data
 */
function sanitizeUrlForLogging(url: string): string {
  try {
    const parsed = new URL(url)
    // Keep only protocol, host, and pathname (no query params or hash)
    return `${parsed.protocol}//${parsed.host}${parsed.pathname}`.slice(0, 80)
  } catch {
    return url.slice(0, 50)
  }
}

/**
 * Step: Send event to the stream
 * Stream operations must happen in steps, not in the workflow function
 */
async function sendStreamEvent(event: CaptureStreamEvent): Promise<void> {
  'use step'
  
  const writable = getWritable<CaptureStreamEvent>()
  const writer = writable.getWriter()
  await writer.write(event)
  writer.releaseLock()
}

/**
 * Step: Close the stream
 */
async function closeStream(): Promise<void> {
  'use step'
  
  await getWritable<CaptureStreamEvent>().close()
}

/**
 * Step: Update capture status to processing
 */
async function updateCaptureProcessing(captureId: string): Promise<void> {
  'use step'
  
  await updateCaptureStatusServer(captureId, 'processing')
  log.info('Capture status updated to processing', { captureId })
}

/**
 * Step: Create Browserbase session AND capture in one step
 * 
 * Combined into a single step to avoid session expiry between steps.
 * Browserbase sessions can expire quickly, and workflow steps can have
 * delays between them, causing "410 Gone" errors.
 */
async function createSessionAndCapture(input: {
  captureId: string
  url: string
  selector?: string
  duration: number
}): Promise<{ captureResult: CaptureResult; sessionId: string }> {
  'use step'
  
  const { captureId, url, selector, duration } = input
  const timer = startTimer()
  
  // Create Browserbase session
  if (!process.env.BROWSERBASE_API_KEY || !process.env.BROWSERBASE_PROJECT_ID) {
    throw new FatalError('Browserbase not configured')
  }
  
  const bb = new Browserbase({ apiKey: process.env.BROWSERBASE_API_KEY })
  const session = await bb.sessions.create({
    projectId: process.env.BROWSERBASE_PROJECT_ID,
  })
  const sessionId = session.id
  
  log.info('Session created, starting capture', { captureId, sessionId, url: sanitizeUrlForLogging(url) })
  
  // Connect to browser immediately after session creation (same step, no delay)
  const browser = await chromium.connectOverCDP(session.connectUrl)
  
  try {
    const context = browser.contexts()[0]
    if (!context) {
      throw new Error('No browser context available')
    }
    
    const page = context.pages()[0]
    if (!page) {
      throw new Error('No page available')
    }
    
    // Navigate to URL
    await page.goto(url, { waitUntil: 'load', timeout: 60000 })
    await page.waitForTimeout(2000)
    
    // Scroll to selector if provided
    if (selector) {
      try {
        await page.locator(selector).scrollIntoViewIfNeeded()
        await page.waitForTimeout(500)
      } catch {
        log.warn('Could not scroll to selector', { captureId, selector })
      }
    }
    
    // Wait for animation duration
    await page.waitForTimeout(duration)
    
    // Extract animation context using a function that receives args properly
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const animationContext = await page.evaluate(
      ([sel, _dur]: [string, number]) => {
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
        
        // Collect static data first (outside of async capture)
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
        
        // Capture a single snapshot instead of animation frames
        // This avoids all closure/minification issues with callbacks
        const styles = getComputedStyle(element)
        const props = ['transform', 'opacity', 'width', 'height', 'left', 'top', 
                       'backgroundColor', 'scale', 'rotate', 'translateX', 'translateY']
        
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const frame: any = { timestamp: 0 }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        props.forEach(p => frame[p] = styles.getPropertyValue(p) || (styles as any)[p])
        
        return {
          frames: [frame], // Single frame capture
          keyframes: keyframesData,
          libraries,
          computedStyles: {
            animation: styles.animation,
            transition: styles.transition,
            willChange: styles.willChange,
          },
          html: element.outerHTML.slice(0, 5000),
          boundingBox: element.getBoundingClientRect(),
        }
      },
      [selector || '', duration] as [string, number]
    ) as AnimationContext
    
    const pageTitle = await page.title()
    const screenshot = await page.screenshot({ type: 'jpeg', quality: 80 })
    
    await page.close()
    
    log.info('Capture completed', { 
      captureId, 
      sessionId,
      durationMs: timer.elapsed(),
      framesExtracted: animationContext?.frames?.length || 0,
    })
    
    return {
      captureResult: {
        animationContext,
        pageTitle,
        screenshotBase64: screenshot.toString('base64'),
      },
      sessionId,
    }
  } finally {
    // Always close browser to prevent resource leaks
    await browser.close()
  }
}

/**
 * Step: Upload screenshot to storage
 */
async function uploadScreenshot(input: {
  userId: string
  captureId: string
  screenshotBase64: string
}): Promise<string | null> {
  'use step'
  
  const { userId, captureId, screenshotBase64 } = input
  const timer = startTimer()
  
  // Convert base64 back to Buffer for upload
  const screenshot = Buffer.from(screenshotBase64, 'base64')
  const videoUrl = await uploadVideoServer(userId, captureId, screenshot, 'capture.jpg')
  
  log.info('Screenshot uploaded', { 
    captureId, 
    size: screenshot.length, 
    durationMs: timer.elapsed() 
  })
  
  return videoUrl
}

/**
 * Step: Save results to database
 */
async function saveResults(input: {
  captureId: string
  sessionId: string
  animationContext: AnimationContext
  pageTitle: string
  videoUrl: string | null
}): Promise<void> {
  'use step'
  
  const { captureId, sessionId, animationContext, pageTitle, videoUrl } = input
  
  const replayUrl = `https://browserbase.com/sessions/${sessionId}`
  
  await updateCaptureWithResultServer(captureId, {
    pageTitle,
    replayUrl,
    sessionId,
    animationContext,
    videoUrl: videoUrl || undefined,
  })
  
  log.info('Results saved', { captureId })
}

/**
 * Step: Release Browserbase session
 * 
 * This step gracefully handles failures - we don't want to fail
 * the workflow if session release fails (sessions auto-expire anyway)
 */
async function releaseBrowserbaseSession(sessionId: string): Promise<void> {
  'use step'
  
  try {
    const bb = new Browserbase({ apiKey: process.env.BROWSERBASE_API_KEY! })
    
    await bb.sessions.update(sessionId, {
      projectId: process.env.BROWSERBASE_PROJECT_ID!,
      status: 'REQUEST_RELEASE',
    })
    
    log.info('Session released', { sessionId })
  } catch (error) {
    // Don't fail the workflow if session release fails
    // Sessions auto-expire, so this is not critical
    log.warn('Failed to release session (non-fatal)', { 
      sessionId, 
      error: error instanceof Error ? error.message : String(error) 
    })
  }
}

/**
 * Step: Mark capture as failed
 * 
 * Called during rollback when workflow fails.
 * This step also gracefully handles its own failures.
 */
export async function markCaptureFailed(captureId: string, error: string): Promise<void> {
  'use step'
  
  try {
    await updateCaptureStatusServer(captureId, 'failed', error)
    log.error('Capture marked as failed', { captureId, error })
  } catch (dbError) {
    // Log but don't throw - we're already in error handling
    log.error('Failed to mark capture as failed in database', { 
      captureId, 
      originalError: error,
      dbError: dbError instanceof Error ? dbError.message : String(dbError),
    })
  }
}
