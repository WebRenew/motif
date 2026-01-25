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
import { uploadScreenshotServer } from '@/lib/supabase/storage';
import { isUserAnonymousServer } from '@/lib/supabase/auth';
import { isValidUUID } from '@/lib/utils';
import { createLogger } from '@/lib/logger';

const logger = createLogger('capture-animation');

// No longer need long timeout - response returns immediately
export const maxDuration = 30;

const bb = new Browserbase({
  apiKey: process.env.BROWSERBASE_API_KEY!,
});

// Extraction script to inject into the page as a string
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
  userId: string,
  url: string,
  selector: string | undefined,
  duration: number,
): Promise<void> {
  // Mark as processing with optimistic locking - only proceeds if currently "pending"
  // This prevents duplicate processing if the job somehow runs twice
  const statusUpdated = await updateCaptureStatusServer(captureId, 'processing', undefined, 'pending');
  if (!statusUpdated) {
    logger.error('Failed to update status to processing (may be deleted or already processing), aborting', {
      captureId,
    });
    return;
  }

  logger.info('Starting background capture', {
    captureId,
    url,
    selector: selector || 'body',
    duration,
  });

  let browser;
  let sessionId: string | undefined;
  try {
    // Create Browserbase session
    const session = await bb.sessions.create({
      projectId: process.env.BROWSERBASE_PROJECT_ID!,
    });
    sessionId = session.id;

    logger.info('Session created', { sessionId: session.id });

    // Connect via Playwright
    browser = await chromium.connectOverCDP(session.connectUrl);
    const context = browser.contexts()[0];
    if (!context) {
      throw new Error('No browser context available');
    }
    const page = context.pages()[0];
    if (!page) {
      throw new Error('No page available in browser context');
    }

    // Navigate to URL - use 'load' instead of 'networkidle' for SPAs
    // networkidle is too strict for sites with analytics/tracking
    await page.goto(url, { waitUntil: 'load', timeout: 45000 });
    await page.waitForTimeout(2000); // Let animations settle

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
        logger.warn('Could not scroll to selector', { selector });
      }
    }

    // Inject and run extraction script (passes args as array to prevent injection)
    const animationContext = await page.evaluate(
      `${extractionScript}(arguments[0])`,
      [selector || '', duration]
    ) as AnimationContext;

    // The extraction script already waits for `duration` via requestAnimationFrame,
    // so we only add a small buffer for the final frame to complete
    await page.waitForTimeout(100);
    
    const afterScreenshot = await page.screenshot({
      type: 'jpeg',
      quality: 70,
      fullPage: false,
    });

    // Get page title for context
    const pageTitle = await page.title();

    // Cleanup browser
    await page.close();
    await browser.close();
    browser = undefined; // Mark as closed to avoid double-close in catch

    // Session replay URL
    const replayUrl = `https://browserbase.com/sessions/${session.id}`;

    logger.info('Capture complete', {
      captureId,
      sessionId: session.id,
      replayUrl,
      framesCapture: animationContext?.frames?.length || 0,
    });

    // Upload screenshots to Storage (more efficient than base64 in DB)
    const [beforeUrl, afterUrl] = await Promise.all([
      uploadScreenshotServer(userId, captureId, beforeScreenshot, 'before'),
      uploadScreenshotServer(userId, captureId, afterScreenshot, 'after'),
    ]);

    // Log if screenshots failed to upload (capture still succeeds)
    if (!beforeUrl || !afterUrl) {
      logger.warn('Screenshot upload failed', {
        captureId,
        beforeUrl: !!beforeUrl,
        afterUrl: !!afterUrl,
      });
    }

    // Update database with results
    const updateSuccess = await updateCaptureWithResultServer(captureId, {
      pageTitle,
      replayUrl,
      sessionId: session.id,
      animationContext,
      screenshotBefore: beforeUrl || undefined,
      screenshotAfter: afterUrl || undefined,
    });

    if (!updateSuccess) {
      logger.error('Failed to save capture results to database', {
        captureId,
        sessionId: session.id,
      });
      // Attempt to mark as failed so user knows something went wrong
      await updateCaptureStatusServer(captureId, 'failed', 'Failed to save capture results');
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Capture failed', {
      captureId,
      sessionId,
      error: errorMessage,
    });

    // Ensure browser is closed
    if (browser) {
      try {
        await browser.close();
      } catch {
        // Ignore cleanup errors
      }
    }

    // Attempt to close the Browserbase session to free resources
    // Note: Browserbase sessions auto-timeout, but explicit release is cleaner
    if (sessionId) {
      try {
        await bb.sessions.update(sessionId, {
          projectId: process.env.BROWSERBASE_PROJECT_ID!,
          status: 'REQUEST_RELEASE',
        });
      } catch {
        logger.warn('Failed to release Browserbase session', { sessionId });
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
    logger.error('Missing Browserbase credentials');
    return NextResponse.json(
      { error: 'Animation capture service not configured' },
      { status: 503 }
    );
  }

  try {
    const body = await request.json();
    const { url, selector: rawSelector, duration = 3000, userId } = body;

    // Validate userId (required for database storage, must be valid UUID)
    if (!userId || typeof userId !== 'string' || !isValidUUID(userId)) {
      return NextResponse.json(
        { error: 'Valid userId is required' },
        { status: 400 }
      );
    }

    // Check if user is anonymous - this feature requires authentication
    const isAnonymous = await isUserAnonymousServer(userId);
    if (isAnonymous === null) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 401 }
      );
    }
    if (isAnonymous) {
      return NextResponse.json(
        { error: 'Authentication required. Please sign in to use animation capture.' },
        { status: 403 }
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

    logger.info('Created pending capture', {
      captureId,
      url,
      selector: selector || 'body',
      duration: captureDuration,
    });

    // Schedule the capture to run after response is sent
    // Wrapped in try/catch to ensure errors don't silently leave captures stuck in "pending"
    after(async () => {
      try {
        await performCapture(captureId, userId, url, selector, captureDuration);
      } catch (error) {
        logger.error('after() callback failed', {
          captureId,
          error: error instanceof Error ? error.message : String(error),
        });
        // Attempt to mark as failed so it doesn't stay stuck in pending
        try {
          await updateCaptureStatusServer(captureId, 'failed', 'Internal error during capture');
        } catch {
          // Last resort - log but can't do more
          logger.error('Failed to mark capture as failed', { captureId });
        }
      }
    });

    // Return immediately with capture ID for polling
    return NextResponse.json({
      captureId,
      status: 'pending',
      message: 'Capture started. Poll GET /api/capture-animation/[id] for status.',
    });
  } catch (error) {
    // Distinguish between JSON parse errors (400) and unexpected errors (500)
    const errorMessage = error instanceof Error ? error.message : String(error);
    const isJsonError = errorMessage.includes('JSON') || error instanceof SyntaxError;
    
    logger.error('Request failed', {
      error: errorMessage,
      isJsonError,
    });

    return NextResponse.json(
      { error: isJsonError ? 'Invalid request body' : 'Internal server error' },
      { status: isJsonError ? 400 : 500 }
    );
  }
}
