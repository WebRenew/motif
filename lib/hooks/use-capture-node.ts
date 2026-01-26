import { useCallback, useRef, useEffect, type MutableRefObject } from 'react'
import type { Node } from '@xyflow/react'
import { toast } from 'sonner'

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
}

type UseCaptureNodeReturn = {
  /** Execute capture for a capture node */
  handleCaptureNode: (nodeId: string) => Promise<void>
  /** Stop/cancel capture and reset node to idle */
  handleStopCapture: (nodeId: string) => void
}

/**
 * Hook for managing capture node execution.
 * Uses /api/capture-frames for simple synchronous screenshot capture.
 */
export function useCaptureNode({
  nodesRef,
  setNodes,
  userIdRef,
}: UseCaptureNodeOptions): UseCaptureNodeReturn {
  // Track active AbortControllers per nodeId for fetch cancellation
  const abortControllersRef = useRef<Map<string, AbortController>>(new Map())
  // Track if component is mounted to prevent state updates after unmount
  const isMountedRef = useRef(true)

  // Cleanup on unmount
  useEffect(() => {
    isMountedRef.current = true
    const abortControllers = abortControllersRef.current
    
    return () => {
      isMountedRef.current = false
      // Abort all active fetch requests
      abortControllers.forEach((controller) => {
        controller.abort()
      })
      abortControllers.clear()
    }
  }, [])

  // Handle capture node execution - simple synchronous capture
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

      // Use simplified capture endpoint
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
  }, [nodesRef, setNodes, userIdRef])

  const handleStopCapture = useCallback((nodeId: string) => {
    // Abort any active fetch
    const controller = abortControllersRef.current.get(nodeId)
    if (controller) {
      controller.abort()
      abortControllersRef.current.delete(nodeId)
    }

    // Reset node to idle state
    if (isMountedRef.current) {
      setNodes((nds) =>
        nds.map(n =>
          n.id === nodeId ? { ...n, data: { ...n.data, status: 'idle', progress: 0, liveViewUrl: undefined } } : n
        )
      )
    }
  }, [setNodes])

  return {
    handleCaptureNode,
    handleStopCapture,
  }
}
