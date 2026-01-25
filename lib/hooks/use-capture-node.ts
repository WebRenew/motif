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
  videoUrl?: string
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
                return { ...n, data: { ...n.data, status: 'capturing', statusMessage: 'Processing in background...' } }
              case 'completed':
                return { ...n, data: { ...n.data, status: 'complete', videoUrl: data.screenshots?.after, captureId: data.captureId, animationContext: data.animationContext } }
              case 'failed':
                return { ...n, data: { ...n.data, status: 'error', error: data.error } }
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
                  n.id === nodeId ? { ...n, data: { ...n.data, status: 'error', error: 'Capture timed out' } } : n
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

  // Handle capture node execution with SSE streaming + polling fallback
  const handleCaptureNode = useCallback(async (nodeId: string) => {
    const node = nodesRef.current.find(n => n.id === nodeId)
    if (!node || node.type !== 'captureNode') return

    const { url, selector, duration } = node.data as CaptureNodeData
    
    if (!url) {
      toast.error('URL required', { description: 'Please enter a URL to capture' })
      return
    }

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

    // Update status to connecting
    setNodes((nds) =>
      nds.map(n => 
        n.id === nodeId ? { ...n, data: { ...n.data, status: 'connecting', error: undefined } } : n
      )
    )

    let captureId: string | null = null

    try {
      const response = await fetch('/api/capture-animation/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url,
          selector: selector || undefined,
          duration: duration * 1000, // Convert to ms
          userId,
        }),
        signal: abortController.signal,
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Capture failed')
      }

      const reader = response.body?.getReader()
      if (!reader) throw new Error('No response stream')

      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        // Check if aborted
        if (abortController.signal.aborted) {
          reader.cancel()
          break
        }

        const { done, value } = await reader.read()
        if (done) break

        // Check mount status after async read
        if (!isMountedRef.current) {
          reader.cancel()
          break
        }

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        // Use index-based iteration to correctly pair event/data lines
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i]
          if (line.startsWith('event: ')) {
            const eventType = line.slice(7)
            const dataLine = lines[i + 1]
            if (dataLine?.startsWith('data: ')) {
              // Skip the data line in next iteration
              i++
              const data = JSON.parse(dataLine.slice(6))
              
              // Track captureId for fallback polling
              if (data.captureId) {
                captureId = data.captureId
              }
              
              // Update node based on event (only if mounted)
              if (isMountedRef.current) {
                setNodes((nds) =>
                  nds.map(n => {
                    if (n.id !== nodeId) return n
                    
                    switch (eventType) {
                      case 'status':
                        // Merge status updates - don't overwrite existing values with undefined
                        return { ...n, data: { ...n.data, status: data.status, ...(data.liveViewUrl && { liveViewUrl: data.liveViewUrl }), ...(data.sessionId && { sessionId: data.sessionId }), ...(data.captureId && { captureId: data.captureId }) } }
                      case 'progress':
                        return { ...n, data: { ...n.data, status: 'capturing', progress: data.percent || 0, currentFrame: data.frame, totalFrames: data.total, statusMessage: data.message } }
                      case 'complete':
                        return { ...n, data: { ...n.data, status: 'complete', videoUrl: data.videoUrl, captureId: data.captureId, animationContext: data.animationContext } }
                      case 'error':
                        return { ...n, data: { ...n.data, status: 'error', error: data.message } }
                      default:
                        return n
                    }
                  })
                )
              }
            }
          }
        }
      }

      // Cleanup abort controller on success
      abortControllersRef.current.delete(nodeId)
    } catch (error) {
      // Cleanup abort controller
      abortControllersRef.current.delete(nodeId)

      // Handle abort gracefully (user cancelled or component unmounted)
      if (error instanceof Error && error.name === 'AbortError') {
        return
      }

      // Don't update state if unmounted
      if (!isMountedRef.current) return

      const message = error instanceof Error ? error.message : 'Capture failed'
      
      // If we have a captureId, the capture might still be running in the background
      // Fall back to polling instead of showing error immediately
      if (captureId) {
        logger.info('Stream disconnected, falling back to polling', { captureId })
        toast.info('Connection interrupted', { description: 'Checking capture status...' })
        setNodes((nds) =>
          nds.map(n => 
            n.id === nodeId ? { ...n, data: { ...n.data, status: 'capturing', statusMessage: 'Reconnecting...', captureId } } : n
          )
        )
        pollCaptureStatus(nodeId, captureId, userId)
        return
      }
      
      // No captureId means failure happened before capture started
      setNodes((nds) =>
        nds.map(n => 
          n.id === nodeId ? { ...n, data: { ...n.data, status: 'error', error: message } } : n
        )
      )
      toast.error('Capture failed', { description: message })
    }
  }, [nodesRef, setNodes, userIdRef, pollCaptureStatus, cancelPolling])

  const handleStopCapture = useCallback((nodeId: string) => {
    // Cancel any active polling
    cancelPolling(nodeId)
    
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
          n.id === nodeId ? { ...n, data: { ...n.data, status: 'idle', progress: 0 } } : n
        )
      )
    }
  }, [setNodes, cancelPolling])

  return {
    handleCaptureNode,
    handleStopCapture,
  }
}
