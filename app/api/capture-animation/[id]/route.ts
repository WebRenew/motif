import { NextRequest, NextResponse } from 'next/server';
import { getAnimationCaptureServer } from '@/lib/supabase/animation-captures';

// UUID format validation
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: captureId } = await params;

  // Validate ID format
  if (!captureId || !UUID_REGEX.test(captureId)) {
    return NextResponse.json(
      { error: 'Invalid capture ID format' },
      { status: 400 }
    );
  }

  const capture = await getAnimationCaptureServer(captureId);

  if (!capture) {
    return NextResponse.json(
      { error: 'Capture not found' },
      { status: 404 }
    );
  }

  // Return different response shapes based on status
  switch (capture.status) {
    case 'pending':
    case 'processing':
      return NextResponse.json({
        captureId: capture.id,
        status: capture.status,
        url: capture.url,
        createdAt: capture.created_at,
      });

    case 'failed':
      return NextResponse.json({
        captureId: capture.id,
        status: 'failed',
        url: capture.url,
        error: capture.error_message || 'Capture failed',
        createdAt: capture.created_at,
      });

    case 'completed':
      return NextResponse.json({
        captureId: capture.id,
        status: 'completed',
        url: capture.url,
        pageTitle: capture.page_title,
        selector: capture.selector,
        replayUrl: capture.replay_url,
        animationContext: capture.animation_context,
        screenshots: {
          before: capture.screenshot_before,
          after: capture.screenshot_after,
        },
        duration: capture.duration,
        createdAt: capture.created_at,
        completedAt: capture.updated_at,
      });

    default:
      return NextResponse.json(
        { error: 'Unknown capture status' },
        { status: 500 }
      );
  }
}
