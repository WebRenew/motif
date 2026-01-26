import { useCallback, useRef, useEffect, type MutableRefObject } from 'react'
import type { Node } from '@xyflow/react'
import { toast } from 'sonner'
import { logger } from '@/lib/logger'

type CaptureNodeData = {
  url: string
  selector?: string
  duration: number
  status?: string
  error?: string
  liveViewUrl?: string
  sessionId?: string
  captureId?: string
  progress?: number
  currentFrame?: number
  totalFrames?: number
  statusMessage?: string
  videoUrl?: string           // Legacy: stitched strip
  frameUrls?: string[]        // New: individual frames
  animationContext?: unknown
}

type UseCaptureNodeOptions = {
  nodesRef: MutableRefObject<Node[]>
  setNodes: (updater: Node[] | ((prev: Node[]) => Node[])) => void
  userIdRef: MutableRefObject<string | null>
  workflowIdRef?: MutableRefObject<string | null> // For upsert support
}

type UseCaptureNodeReturn = {
  /** Execute capture for a capture node */
  handleCaptureNode: (nodeId: string) => Promise<void>
  /** Stop/cancel capture and reset node to idle */
  handleStopCapture: (nodeId: string) => void
}

/**
 * Hook for managing capture node execution with SSE streaming and polling fallback.
 * 
 * Handles:
 * - SSE streaming for real-time capture progress
 * - Automatic fallback to polling if stream disconnects
 * - Node state updates for all capture phases
 * - Proper cleanup on unmount (cancels polling and aborts fetch)
 */
export function useCaptureNode({
  nodesRef,
  setNodes,
  userIdRef,
  workflowIdRef,
}: UseCaptureNodeOptions): UseCaptureNodeReturn {
  // Track active polls per nodeId to allow cancellation
  const activePollsRef = useRef<Map<string, boolean>>(new Map())
  // Track active AbortControllers per nodeId for fetch cancellation
  const abortControllersRef = useRef<Map<string, AbortController>>(new Map())
  // Track if component is mounted to prevent state updates after unmount
  const isMountedRef = useRef(true)

  // Cleanup on unmount
  useEffect(() => {
    isMountedRef.current = true
    // Capture refs at effect setup time for cleanup
    const activePolls = activePollsRef.current
    const abortControllers = abortControllersRef.current
    
    return () => {
      isMountedRef.current = false
      // Cancel all active polls
      activePolls.forEach((_, nodeId) => {
        activePolls.set(nodeId, false)
      })
      activePolls.clear()
      // Abort all active fetch requests
      abortControllers.forEach((controller) => {
        controller.abort()
      })
      abortControllers.clear()
    }
  }, [])

  // Poll capture status as fallback when stream disconnects
  const pollCaptureStatus = useCallback((nodeId: string, captureId: string, userId: string) => {
    const maxAttempts = 60 // 5 minutes at 5s intervals
    let attempts = 0
    
    // Mark this nodeId as actively polling
    activePollsRef.current.set(nodeId, true)
    
    const poll = async () => {
      // Check if polling was cancelled or component unmounted
      if (!activePollsRef.current.get(nodeId) || !isMountedRef.current) {
        activePollsRef.current.delete(nodeId)
        return
      }

      try {
        const response = await fetch(`/api/capture-animation/${captureId}?userId=${userId}`)
        
        // Check again after async operation
        if (!activePollsRef.current.get(nodeId) || !isMountedRef.current) {
          activePollsRef.current.delete(nodeId)
          return
        }

        if (!response.ok) {
          throw new Error('Failed to fetch capture status')
        }
        
        const data = await response.json()
        
        // Final check before state update
        if (!isMountedRef.current) return

        setNodes((nds) =>
          nds.map(n => {
            if (n.id !== nodeId) return n
            
            switch (data.status) {
              case 'pending':
              case 'processing':
                return { ...n, data: { ...n.data, status: 'capturing', statusMessage: 'Processing in background...', liveViewUrl: undefined } }
              case 'completed':
                return { ...n, data: { ...n.data, status: 'complete', videoUrl: data.videoUrl, captureId: data.captureId, animationContext: data.animationContext, liveViewUrl: undefined } }
              case 'failed':
                return { ...n, data: { ...n.data, status: 'error', error: data.error, liveViewUrl: undefined } }
              default:
                return n
            }
          })
        )
        
        // Continue polling if still processing and not cancelled
        if ((data.status === 'pending' || data.status === 'processing') && activePollsRef.current.get(nodeId)) {
          attempts++
          if (attempts < maxAttempts) {
            setTimeout(poll, 5000)
          } else {
            activePollsRef.current.delete(nodeId)
            if (isMountedRef.current) {
              setNodes((nds) =>
                nds.map(n =>
                  n.id === nodeId ? { ...n, data: { ...n.data, status: 'error', error: 'Capture timed out', liveViewUrl: undefined } } : n
                )
              )
            }
          }
        } else {
          // Polling complete (success or failure)
          activePollsRef.current.delete(nodeId)
        }
      } catch (error) {
        // Check if still active before handling error
        if (!activePollsRef.current.get(nodeId) || !isMountedRef.current) {
          activePollsRef.current.delete(nodeId)
          return
        }

        logger.error('Polling error', { error: error instanceof Error ? error.message : String(error) })
        attempts++
        if (attempts < maxAttempts && activePollsRef.current.get(nodeId)) {
          setTimeout(poll, 5000)
        } else {
          activePollsRef.current.delete(nodeId)
        }
      }
    }
    
    poll()
  }, [setNodes])

  // Cancel polling for a specific node
  const cancelPolling = useCallback((nodeId: string) => {
    activePollsRef.current.set(nodeId, false)
    activePollsRef.current.delete(nodeId)
  }, [])

  // Handle capture node execution - simple synchronous capture (no SSE/polling)
  const handleCaptureNode = useCallback(async (nodeId: string) => {
    const node = nodesRef.current.find(n => n.id === nodeId)
    if (!node || node.type !== 'captureNode') return

    const { url: rawUrl, selector, duration } = node.data as CaptureNodeData
    
    if (!rawUrl) {
      toast.error('URL required', { description: 'Please enter a URL to capture' })
      return
    }

    // Normalize URL by adding https:// if missing
    const trimmedUrl = rawUrl.trim()
    const url = (trimmedUrl.startsWith('http://') || trimmedUrl.startsWith('https://')) 
      ? trimmedUrl 
      : `https://${trimmedUrl}`

    const userId = userIdRef.current
    if (!userId) {
      toast.error('Authentication required', { description: 'Please sign in to use capture' })
      return
    }

    // Cancel any existing capture for this node
    cancelPolling(nodeId)
    const existingController = abortControllersRef.current.get(nodeId)
    if (existingController) {
      existingController.abort()
    }

    // Create new AbortController for this capture
    const abortController = new AbortController()
    abortControllersRef.current.set(nodeId, abortController)

    // Calculate expected frames for progress display
    const durationSeconds = Math.min(Math.max(duration, 1), 5)
    const expectedFrames = Math.min(Math.ceil(durationSeconds * 2), 10)

    // Reset state and set to connecting
    setNodes((nds) =>
      nds.map(n =>
        n.id === nodeId ? {
          ...n,
          data: {
            ...n.data,
            status: 'connecting',
            error: undefined,
            liveViewUrl: undefined,
            videoUrl: undefined,
            frameUrls: undefined,
            animationContext: undefined,
            captureId: undefined,
            progress: 0,
            totalFrames: expectedFrames,
            statusMessage: 'Starting capture...',
          }
        } : n
      )
    )

    try {
      // Update to capturing status
      setNodes((nds) =>
        nds.map(n =>
          n.id === nodeId ? {
            ...n,
            data: { ...n.data, status: 'capturing', statusMessage: `Capturing ${expectedFrames} frames...` }
          } : n
        )
      )

      // Use new simplified capture endpoint
      const response = await fetch('/api/capture-frames', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url,
          selector: selector || undefined,
          duration: durationSeconds,
          userId,
        }),
        signal: abortController.signal,
      })

      const data = await response.json()

      // Cleanup abort controller
      abortControllersRef.current.delete(nodeId)

      if (!isMountedRef.current) return

      if (!response.ok || !data.success) {
        setNodes((nds) =>
          nds.map(n =>
            n.id === nodeId ? { 
              ...n, 
              data: { ...n.data, status: 'error', error: data.error || 'Capture failed' } 
            } : n
          )
        )
        toast.error('Capture failed', { description: data.error })
        return
      }

      // Success - update with frame URLs
      setNodes((nds) =>
        nds.map(n =>
          n.id === nodeId ? {
            ...n,
            data: {
              ...n.data,
              status: 'complete',
              frameUrls: data.frameUrls,
              totalFrames: data.frameUrls?.length || 0,
              animationContext: data.animationContext,
              statusMessage: '',
            }
          } : n
        )
      )

      toast.success('Capture complete', { 
        description: `${data.frameUrls?.length || 0} frames captured` 
      })

    } catch (error) {
      abortControllersRef.current.delete(nodeId)

      if (error instanceof Error && error.name === 'AbortError') {
        return // User cancelled
      }

      if (!isMountedRef.current) return

      const message = error instanceof Error ? error.message : 'Capture failed'
      setNodes((nds) =>
        nds.map(n =>
          n.id === nodeId ? { ...n, data: { ...n.data, status: 'error', error: message } } : n
        )
      )
      toast.error('Capture failed', { description: message })
    }
  }, [nodesRef, setNodes, userIdRef, cancelPolling])

  const handleStopCapture = useCallback((nodeId: string) => {
    // Cancel any active polling
    cancelPolling(nodeId)
    
    // Abort any active fetch
    const controller = abortControllersRef.current.get(nodeId)
    if (controller) {
      controller.abort()
      abortControllersRef.current.delete(nodeId)
    }

    // Reset node to idle state and clear live view
    if (isMountedRef.current) {
      setNodes((nds) =>
        nds.map(n =>
          n.id === nodeId ? { ...n, data: { ...n.data, status: 'idle', progress: 0, liveViewUrl: undefined } } : n
        )
      )
    }
  }, [setNodes, cancelPolling])

  return {
    handleCaptureNode,
    handleStopCapture,
  }
}
