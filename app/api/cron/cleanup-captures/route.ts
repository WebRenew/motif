import { NextRequest, NextResponse } from 'next/server';
import { cleanupStuckCapturesServer } from '@/lib/supabase/animation-captures';

/**
 * Cron job to clean up stuck animation captures.
 * Runs every 5 minutes via Vercel Cron.
 * 
 * Captures stuck in "pending" or "processing" for > 10 minutes
 * are marked as "failed" to prevent indefinite waiting.
 */
export async function GET(request: NextRequest) {
  // Verify cron secret to prevent unauthorized access
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    console.error('[cron/cleanup-captures] CRON_SECRET not configured');
    return NextResponse.json(
      { error: 'Cron not configured' },
      { status: 503 }
    );
  }

  if (authHeader !== `Bearer ${cronSecret}`) {
    console.warn('[cron/cleanup-captures] Unauthorized cron request');
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  try {
    const result = await cleanupStuckCapturesServer();

    console.log('[cron/cleanup-captures] Cleanup completed:', {
      cleaned: result.cleaned,
      errors: result.errors.length,
      timestamp: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      cleaned: result.cleaned,
      errors: result.errors,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[cron/cleanup-captures] Cleanup failed:', {
      error: errorMessage,
      timestamp: new Date().toISOString(),
    });

    return NextResponse.json(
      { error: 'Cleanup failed', details: errorMessage },
      { status: 500 }
    );
  }
}
