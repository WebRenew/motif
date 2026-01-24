import { NextRequest, NextResponse } from 'next/server';
import { chromium } from 'playwright-core';
import Browserbase from '@browserbasehq/sdk';
import { checkRateLimit } from '@/lib/rate-limit';

export const maxDuration = 120;

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
    const { url, selector: rawSelector, duration = 3000 } = body;

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

    console.log('[capture-animation] Starting capture:', {
      url,
      selector: selector || 'body',
      duration: captureDuration,
      timestamp: new Date().toISOString(),
    });

    // Create Browserbase session
    const session = await bb.sessions.create({
      projectId: process.env.BROWSERBASE_PROJECT_ID!,
    });

    console.log('[capture-animation] Session created:', session.id);

    // Connect via Playwright
    const browser = await chromium.connectOverCDP(session.connectUrl);
    const context = browser.contexts()[0];
    const page = context.pages()[0];

    try {
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
        `(${extractionScript})('${selector || ''}', ${captureDuration})`
      );

      // Wait for capture to complete, then take "after" screenshot
      await page.waitForTimeout(captureDuration);
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

      // Session replay URL (free from Browserbase)
      const replayUrl = `https://browserbase.com/sessions/${session.id}`;

      console.log('[capture-animation] Capture complete:', {
        sessionId: session.id,
        replayUrl,
        framesCapture: (animationContext as { frames?: unknown[] })?.frames?.length || 0,
        timestamp: new Date().toISOString(),
      });

      return NextResponse.json({
        success: true,
        url,
        pageTitle,
        selector,
        replayUrl,
        animationContext,
        screenshots: {
          before: `data:image/jpeg;base64,${beforeScreenshot.toString('base64')}`,
          after: `data:image/jpeg;base64,${afterScreenshot.toString('base64')}`,
        },
        capturedAt: new Date().toISOString(),
        duration: captureDuration,
      });
    } catch (pageError) {
      // Ensure browser is closed even if page operations fail
      await browser.close();
      throw pageError;
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[capture-animation] Capture failed:', {
      error: errorMessage,
      timestamp: new Date().toISOString(),
    });

    // Provide user-friendly error messages
    let userMessage = 'Animation capture failed';
    let statusCode = 500;

    if (errorMessage.includes('timeout') || errorMessage.includes('Timeout')) {
      userMessage = 'Page took too long to load. Please try a different URL.';
      statusCode = 504;
    } else if (errorMessage.includes('net::ERR_') || errorMessage.includes('Navigation')) {
      userMessage = 'Could not load the page. Please check the URL and try again.';
      statusCode = 502;
    } else if (errorMessage.includes('Browserbase') || errorMessage.includes('session')) {
      userMessage = 'Browser automation service error. Please try again.';
      statusCode = 503;
    }

    return NextResponse.json(
      {
        error: userMessage,
        ...(process.env.NODE_ENV !== 'production' && { debugError: errorMessage }),
      },
      { status: statusCode }
    );
  }
}
