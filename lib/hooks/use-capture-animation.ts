import type { AnimationContext } from '@/lib/supabase/animation-captures'
import { logger } from '@/lib/logger'

export type CaptureStatus = 'idle' | 'starting' | 'pending' | 'processing' | 'completed' | 'failed'

export interface CaptureResult {
  captureId: string
  status: CaptureStatus
  url?: string
  pageTitle?: string
  selector?: string
  replayUrl?: string
  animationContext?: AnimationContext
  screenshots?: {
    before?: string
    after?: string
  }
  error?: string
  createdAt?: string
  completedAt?: string
}

interface StartCaptureParams {
  url: string
  selector?: string
  duration?: number
  userId: string
}

const POLL_INTERVAL = 2500 // 2.5 seconds
const MAX_POLL_ATTEMPTS = 60 // 2.5 minutes max

/**
 * Start an animation capture and poll for completion.
 * Returns a promise that resolves when capture is complete or fails.
 */
export async function captureAnimation(
  params: StartCaptureParams,
  options?: {
    signal?: AbortSignal
    onStatusChange?: (status: CaptureStatus, result?: CaptureResult) => void
  }
): Promise<CaptureResult> {
  const { signal, onStatusChange } = options || {}

  onStatusChange?.('starting')

  // Start the capture
  const startResponse = await fetch('/api/capture-animation', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      url: params.url,
      selector: params.selector,
      duration: params.duration || 6000,
      userId: params.userId,
    }),
    signal,
  })

  if (!startResponse.ok) {
    const errorData = await startResponse.json().catch(() => ({}))
    const result: CaptureResult = {
      captureId: '',
      status: 'failed',
      error: errorData.error || `Failed to start capture: ${startResponse.status}`,
    }
    onStatusChange?.('failed', result)
    throw new Error(result.error)
  }

  const startData = await startResponse.json()
  const { captureId } = startData

  if (!captureId) {
    const result: CaptureResult = {
      captureId: '',
      status: 'failed',
      error: 'No capture ID returned',
    }
    onStatusChange?.('failed', result)
    throw new Error(result.error)
  }

  onStatusChange?.('pending', { captureId, status: 'pending' })

  // Poll for completion
  let attempts = 0
  while (attempts < MAX_POLL_ATTEMPTS) {
    if (signal?.aborted) {
      throw new Error('Capture aborted')
    }

    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL))
    attempts++

    const pollResponse = await fetch(`/api/capture-animation/${captureId}`, {
      signal,
    })

    if (!pollResponse.ok) {
      // Network error during polling - keep trying
      logger.warn('Poll attempt failed', { attempt: attempts, status: pollResponse.status })
      continue
    }

    const pollData = await pollResponse.json()
    const result: CaptureResult = {
      captureId,
      status: pollData.status,
      url: pollData.url,
      pageTitle: pollData.pageTitle,
      selector: pollData.selector,
      replayUrl: pollData.replayUrl,
      animationContext: pollData.animationContext,
      screenshots: pollData.screenshots,
      error: pollData.error,
      createdAt: pollData.createdAt,
      completedAt: pollData.completedAt,
    }

    onStatusChange?.(pollData.status, result)

    if (pollData.status === 'completed') {
      return result
    }

    if (pollData.status === 'failed') {
      throw new Error(pollData.error || 'Capture failed')
    }

    // Still pending or processing - continue polling
  }

  // Timeout
  const timeoutResult: CaptureResult = {
    captureId,
    status: 'failed',
    error: 'Capture timed out after 2.5 minutes',
  }
  onStatusChange?.('failed', timeoutResult)
  throw new Error(timeoutResult.error)
}

/**
 * Format animation context as markdown for display/prompting.
 */
export function formatAnimationContextAsMarkdown(
  result: CaptureResult
): string {
  if (!result.animationContext) {
    return 'No animation data captured.'
  }

  const ctx = result.animationContext
  const lines: string[] = []

  lines.push(`# Animation Capture Results`)
  lines.push(``)
  lines.push(`**Source URL:** ${result.url || 'Unknown'}`)
  if (result.pageTitle) {
    lines.push(`**Page Title:** ${result.pageTitle}`)
  }
  if (result.selector) {
    lines.push(`**Target Selector:** \`${result.selector}\``)
  }
  if (result.replayUrl) {
    lines.push(`**Session Replay:** ${result.replayUrl}`)
  }
  lines.push(``)

  // Libraries detected
  if (ctx.libraries) {
    lines.push(`## Animation Libraries Detected`)
    const detected = Object.entries(ctx.libraries)
      .filter(([, v]) => v)
      .map(([k]) => k)
    if (detected.length > 0) {
      lines.push(detected.map(lib => `- ${lib}`).join('\n'))
    } else {
      lines.push('- No known animation libraries detected (likely CSS animations)')
    }
    lines.push(``)
  }

  // Computed styles
  if (ctx.computedStyles) {
    lines.push(`## CSS Animation Properties`)
    if (ctx.computedStyles.animation && ctx.computedStyles.animation !== 'none') {
      lines.push(`**animation:** \`${ctx.computedStyles.animation}\``)
    }
    if (ctx.computedStyles.transition && ctx.computedStyles.transition !== 'none 0s ease 0s') {
      lines.push(`**transition:** \`${ctx.computedStyles.transition}\``)
    }
    if (ctx.computedStyles.willChange && ctx.computedStyles.willChange !== 'auto') {
      lines.push(`**will-change:** \`${ctx.computedStyles.willChange}\``)
    }
    lines.push(``)
  }

  // Keyframes
  if (ctx.keyframes && Object.keys(ctx.keyframes).length > 0) {
    lines.push(`## CSS Keyframes`)
    for (const [name, frames] of Object.entries(ctx.keyframes)) {
      lines.push(`### @keyframes ${name}`)
      lines.push('```css')
      for (const frame of frames) {
        lines.push(`${frame.offset} { ${frame.styles} }`)
      }
      lines.push('```')
    }
    lines.push(``)
  }

  // Captured frames summary
  if (ctx.frames && ctx.frames.length > 0) {
    lines.push(`## Captured Frames`)
    lines.push(`Captured ${ctx.frames.length} frames over ${ctx.frames[ctx.frames.length - 1]?.timestamp || 0}ms`)

    // Show first and last frame transforms
    const first = ctx.frames[0]
    const last = ctx.frames[ctx.frames.length - 1]

    if (first?.transform !== last?.transform) {
      lines.push(``)
      lines.push(`**Transform change:**`)
      lines.push(`- Start: \`${first?.transform || 'none'}\``)
      lines.push(`- End: \`${last?.transform || 'none'}\``)
    }

    if (first?.opacity !== last?.opacity) {
      lines.push(``)
      lines.push(`**Opacity change:** ${first?.opacity} → ${last?.opacity}`)
    }
    lines.push(``)
  }

  // Bounding box
  if (ctx.boundingBox) {
    lines.push(`## Element Dimensions`)
    lines.push(`- Width: ${Math.round(ctx.boundingBox.width)}px`)
    lines.push(`- Height: ${Math.round(ctx.boundingBox.height)}px`)
    lines.push(`- Position: (${Math.round(ctx.boundingBox.x)}, ${Math.round(ctx.boundingBox.y)})`)
    lines.push(``)
  }

  // HTML snippet
  if (ctx.html) {
    lines.push(`## Element HTML`)
    lines.push('```html')
    lines.push(ctx.html.slice(0, 2000))
    if (ctx.html.length > 2000) {
      lines.push('... (truncated)')
    }
    lines.push('```')
  }

  return lines.join('\n')
}
