import { NextRequest, NextResponse } from 'next/server';
import { after } from 'next/server';
import { chromium } from 'playwright-core';
import Browserbase from '@browserbasehq/sdk';
import { checkRateLimit } from '@/lib/rate-limit';
import {
  createPendingCaptureServer,
  updateCaptureStatusServer,
  updateCaptureWithResultServer,
  type AnimationContext,
} from '@/lib/supabase/animation-captures';

// No longer need long timeout - response returns immediately
export const maxDuration = 30;

const bb = new Browserbase({
  apiKey: process.env.BROWSERBASE_API_KEY!,
});

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
          html: element.outerHTML.slice(0, 5000), // Limit size
          boundingBox: element.getBoundingClientRect(),
        });
      }
    }
    requestAnimationFrame(capture);
  });
})
`;

/**
 * Validates URL to ensure it's a valid HTTP(S) URL
 */
function validateUrl(url: string): { valid: boolean; error?: string } {
  if (!url || typeof url !== 'string') {
    return { valid: false, error: 'URL is required' };
  }

  try {
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return { valid: false, error: 'URL must use http or https protocol' };
    }
    return { valid: true };
  } catch {
    return { valid: false, error: 'Invalid URL format' };
  }
}

/**
 * Validates CSS selector for safety
 */
function validateSelector(selector: string | undefined): string | undefined {
  if (!selector) return undefined;
  
  // Basic validation - reject obvious injection attempts
  if (selector.length > 200) {
    throw new Error('Selector too long');
  }
  
  // Only allow safe characters in CSS selectors
  if (!/^[a-zA-Z0-9_\-#.\[\]="':,\s()>+~*^$|]+$/.test(selector)) {
    throw new Error('Invalid characters in selector');
  }
  
  return selector;
}

/**
 * Perform the actual Browserbase capture (runs in after()).
 */
async function performCapture(
  captureId: string,
  url: string,
  selector: string | undefined,
  duration: number,
): Promise<void> {
  // Mark as processing
  await updateCaptureStatusServer(captureId, 'processing');

  console.log('[capture-animation] Starting background capture:', {
    captureId,
    url,
    selector: selector || 'body',
    duration,
    timestamp: new Date().toISOString(),
  });

  let browser;
  try {
    // Create Browserbase session
    const session = await bb.sessions.create({
      projectId: process.env.BROWSERBASE_PROJECT_ID!,
    });

    console.log('[capture-animation] Session created:', session.id);

    // Connect via Playwright
    browser = await chromium.connectOverCDP(session.connectUrl);
    const context = browser.contexts()[0];
    const page = context.pages()[0];

    // Navigate to URL
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(1000); // Let animations settle

    // Take "before" screenshot
    const beforeScreenshot = await page.screenshot({
      type: 'jpeg',
      quality: 70,
      fullPage: false,
    });

    // If selector provided, scroll to it
    if (selector) {
      try {
        await page.locator(selector).scrollIntoViewIfNeeded();
        await page.waitForTimeout(500);
      } catch {
        console.warn('[capture-animation] Could not scroll to selector:', selector);
      }
    }

    // Inject and run extraction script
    const animationContext = await page.evaluate(
      `(${extractionScript})('${selector || ''}', ${duration})`
    ) as AnimationContext;

    // Wait for capture to complete, then take "after" screenshot
    await page.waitForTimeout(duration);
    const afterScreenshot = await page.screenshot({
      type: 'jpeg',
      quality: 70,
      fullPage: false,
    });

    // Get page title for context
    const pageTitle = await page.title();

    // Cleanup
    await page.close();
    await browser.close();

    // Session replay URL
    const replayUrl = `https://browserbase.com/sessions/${session.id}`;

    console.log('[capture-animation] Capture complete:', {
      captureId,
      sessionId: session.id,
      replayUrl,
      framesCapture: animationContext?.frames?.length || 0,
      timestamp: new Date().toISOString(),
    });

    // Update database with results
    await updateCaptureWithResultServer(captureId, {
      pageTitle,
      replayUrl,
      sessionId: session.id,
      animationContext,
      screenshotBefore: `data:image/jpeg;base64,${beforeScreenshot.toString('base64')}`,
      screenshotAfter: `data:image/jpeg;base64,${afterScreenshot.toString('base64')}`,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[capture-animation] Capture failed:', {
      captureId,
      error: errorMessage,
      timestamp: new Date().toISOString(),
    });

    // Ensure browser is closed
    if (browser) {
      try {
        await browser.close();
      } catch {
        // Ignore cleanup errors
      }
    }

    // Provide user-friendly error messages
    let userMessage = 'Animation capture failed';
    if (errorMessage.includes('timeout') || errorMessage.includes('Timeout')) {
      userMessage = 'Page took too long to load. Please try a different URL.';
    } else if (errorMessage.includes('net::ERR_') || errorMessage.includes('Navigation')) {
      userMessage = 'Could not load the page. Please check the URL and try again.';
    } else if (errorMessage.includes('Browserbase') || errorMessage.includes('session')) {
      userMessage = 'Browser automation service error. Please try again.';
    }

    // Update database with error
    await updateCaptureStatusServer(captureId, 'failed', userMessage);
  }
}

export async function POST(request: NextRequest) {
  // Check rate limit first
  const rateLimitResult = await checkRateLimit();
  if (!rateLimitResult.success) {
    const isConfigError = 'error' in rateLimitResult;
    return NextResponse.json(
      {
        error: isConfigError
          ? 'Service temporarily unavailable'
          : `Rate limit exceeded. Try again later.`,
        ...(isConfigError ? {} : {
          limit: rateLimitResult.limit,
          remaining: rateLimitResult.remaining,
          reset: rateLimitResult.reset,
        }),
      },
      {
        status: isConfigError ? 503 : 429,
        headers: isConfigError ? {} : {
          'X-RateLimit-Limit': String(rateLimitResult.limit),
          'X-RateLimit-Remaining': String(rateLimitResult.remaining),
          'X-RateLimit-Reset': String(rateLimitResult.reset),
        },
      }
    );
  }

  // Check for required environment variables
  if (!process.env.BROWSERBASE_API_KEY || !process.env.BROWSERBASE_PROJECT_ID) {
    console.error('[capture-animation] Missing Browserbase credentials');
    return NextResponse.json(
      { error: 'Animation capture service not configured' },
      { status: 503 }
    );
  }

  try {
    const body = await request.json();
    const { url, selector: rawSelector, duration = 3000, userId } = body;

    // Validate userId (required for database storage)
    if (!userId || typeof userId !== 'string') {
      return NextResponse.json(
        { error: 'userId is required' },
        { status: 400 }
      );
    }

    // Validate URL
    const urlValidation = validateUrl(url);
    if (!urlValidation.valid) {
      return NextResponse.json({ error: urlValidation.error }, { status: 400 });
    }

    // Validate selector
    let selector: string | undefined;
    try {
      selector = validateSelector(rawSelector);
    } catch (selectorError) {
      return NextResponse.json(
        { error: selectorError instanceof Error ? selectorError.message : 'Invalid selector' },
        { status: 400 }
      );
    }

    // Validate duration
    const captureDuration = Math.min(Math.max(Number(duration) || 3000, 1000), 10000);

    // Create pending capture record
    const captureId = await createPendingCaptureServer(userId, {
      url,
      selector,
      duration: captureDuration,
    });

    if (!captureId) {
      return NextResponse.json(
        { error: 'Failed to create capture job' },
        { status: 500 }
      );
    }

    console.log('[capture-animation] Created pending capture:', {
      captureId,
      url,
      selector: selector || 'body',
      duration: captureDuration,
      timestamp: new Date().toISOString(),
    });

    // Schedule the capture to run after response is sent
    after(async () => {
      await performCapture(captureId, url, selector, captureDuration);
    });

    // Return immediately with capture ID for polling
    return NextResponse.json({
      captureId,
      status: 'pending',
      message: 'Capture started. Poll GET /api/capture-animation/[id] for status.',
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[capture-animation] Request failed:', {
      error: errorMessage,
      timestamp: new Date().toISOString(),
    });

    return NextResponse.json(
      { error: 'Invalid request' },
      { status: 400 }
    );
  }
}
