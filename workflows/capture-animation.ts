/**
 * Animation Capture Workflow
 * 
 * Durable workflow for capturing website animations using Browserbase.
 * Automatically retries failed steps and survives crashes/deployments.
 */

import { FatalError } from 'workflow'
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

// Extraction script to inject into the page
const extractionScript = `
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

interface BrowserbaseSession {
  sessionId: string
  connectUrl: string
  debuggerUrl: string
}

interface CaptureResult {
  animationContext: AnimationContext
  pageTitle: string
  screenshotBase64: string // Base64 encoded for workflow serialization
}

/**
 * Main capture workflow - orchestrates the entire capture process
 * Includes error handling and session cleanup on failure
 */
export async function captureAnimationWorkflow(input: CaptureInput) {
  'use workflow'
  
  const { captureId, userId, url, selector, duration } = input
  const workflowTimer = startTimer()
  
  log.info('Workflow started', { captureId, userId: userId.slice(0, 8), url: url.slice(0, 50) })
  
  // Track session for cleanup on failure
  let sessionId: string | undefined
  
  try {
    // Step 1: Update status to processing
    await updateCaptureProcessing(captureId)
    
    // Step 2: Create Browserbase session
    const session = await createBrowserbaseSession(captureId)
    sessionId = session.sessionId
    
    // Step 3: Capture animation
    const captureResult = await captureAnimation({
      captureId,
      url,
      selector,
      duration,
      connectUrl: session.connectUrl,
      sessionId: session.sessionId,
    })
    
    // Step 4: Upload screenshot
    const videoUrl = await uploadScreenshot({
      userId,
      captureId,
      screenshotBase64: captureResult.screenshotBase64,
    })
    
    // Step 5: Save results to database
    await saveResults({
      captureId,
      sessionId: session.sessionId,
      animationContext: captureResult.animationContext,
      pageTitle: captureResult.pageTitle,
      videoUrl,
    })
    
    // Step 6: Release Browserbase session
    await releaseBrowserbaseSession(session.sessionId)
    
    log.info('Workflow completed', { 
      captureId, 
      durationMs: workflowTimer.elapsed(),
      framesExtracted: captureResult.animationContext?.frames?.length || 0,
    })
    
    return {
      captureId,
      videoUrl,
      animationContext: captureResult.animationContext,
      pageTitle: captureResult.pageTitle,
    }
  } catch (error) {
    // Mark capture as failed
    const errorMessage = error instanceof Error ? error.message : 'Unknown workflow error'
    log.error('Workflow failed', { captureId, error: errorMessage, durationMs: workflowTimer.elapsed() })
    
    await markCaptureFailed(captureId, errorMessage)
    
    // Attempt to release session if we have one
    if (sessionId) {
      await releaseBrowserbaseSession(sessionId)
    }
    
    // Re-throw to mark workflow as failed
    throw error
  }
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
 * Step: Create Browserbase session
 * Retries on transient errors (network issues, API rate limits)
 */
async function createBrowserbaseSession(captureId: string): Promise<BrowserbaseSession> {
  'use step'
  
  const timer = startTimer()
  
  if (!process.env.BROWSERBASE_API_KEY || !process.env.BROWSERBASE_PROJECT_ID) {
    throw new FatalError('Browserbase not configured')
  }
  
  const bb = new Browserbase({ apiKey: process.env.BROWSERBASE_API_KEY })
  
  const session = await bb.sessions.create({
    projectId: process.env.BROWSERBASE_PROJECT_ID,
  })
  
  const debugInfo = await bb.sessions.debug(session.id)
  
  log.info('Browserbase session created', { 
    captureId, 
    sessionId: session.id, 
    durationMs: timer.elapsed() 
  })
  
  return {
    sessionId: session.id,
    connectUrl: session.connectUrl,
    debuggerUrl: debugInfo.debuggerFullscreenUrl,
  }
}

/**
 * Step: Capture animation from the page
 * This is the main capture logic - retries on page load failures
 */
async function captureAnimation(input: {
  captureId: string
  url: string
  selector?: string
  duration: number
  connectUrl: string
  sessionId: string
}): Promise<CaptureResult> {
  'use step'
  
  const { captureId, url, selector, duration, connectUrl, sessionId } = input
  const timer = startTimer()
  
  log.info('Starting capture', { captureId, sessionId, url: url.slice(0, 50) })
  
  const browser = await chromium.connectOverCDP(connectUrl)
  
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
    
    // Extract animation context
    const animationContext = await page.evaluate(
      `${extractionScript}(arguments[0])`,
      [selector || '', duration]
    ) as AnimationContext
    
    const pageTitle = await page.title()
    const screenshot = await page.screenshot({ type: 'jpeg', quality: 80 })
    
    await page.close()
    
    log.info('Capture completed', { 
      captureId, 
      durationMs: timer.elapsed(),
      framesExtracted: animationContext?.frames?.length || 0,
    })
    
    return {
      animationContext,
      pageTitle,
      screenshotBase64: screenshot.toString('base64'), // Serialize for workflow durability
    }
  } finally {
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
 * Non-critical - we don't want to fail the workflow if this fails
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
    log.warn('Failed to release session', { sessionId, error: String(error) })
  }
}

/**
 * Mark capture as failed - called when workflow fails
 */
export async function markCaptureFailed(captureId: string, error: string): Promise<void> {
  'use step'
  
  await updateCaptureStatusServer(captureId, 'failed', error)
  log.error('Capture marked as failed', { captureId, error })
}
