import { NextRequest, NextResponse } from 'next/server';
import { getAnimationCaptureServer } from '@/lib/supabase/animation-captures';
import { isUserAnonymousServer } from '@/lib/supabase/auth';
import { isValidUUID } from '@/lib/utils';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: captureId } = await params;

  // Validate ID format
  if (!captureId || !isValidUUID(captureId)) {
    return NextResponse.json(
      { error: 'Invalid capture ID format' },
      { status: 400 }
    );
  }

  // userId is required for ownership verification
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');
  
  if (!userId || !isValidUUID(userId)) {
    return NextResponse.json(
      { error: 'Valid userId query parameter is required' },
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
      { error: 'Authentication required' },
      { status: 403 }
    );
  }

  const capture = await getAnimationCaptureServer(captureId);

  if (!capture) {
    return NextResponse.json(
      { error: 'Capture not found' },
      { status: 404 }
    );
  }

  // Verify ownership - users can only view their own captures
  if (capture.user_id !== userId) {
    return NextResponse.json(
      { error: 'Capture not found' }, // Don't reveal that it exists but belongs to someone else
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
