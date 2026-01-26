export type WorkflowImage = {
  url: string
  mediaType: string
  sequenceNumber?: number
  /** If this image is a horizontal frame strip from animation capture */
  frameStripInfo?: {
    totalFrames: number
    excludedFrames: number[]
  }
}

export type WorkflowTextInput = {
  content: string
  language?: string
  label?: string
}

export type StickyNoteColor = "yellow" | "pink" | "blue" | "green" | "purple" | "orange"

export type StickyNoteNodeData = {
  content: string
  color: StickyNoteColor
  fontSize: "sm" | "md" | "lg"
}

export type CaptureStatus = 'idle' | 'connecting' | 'live' | 'capturing' | 'complete' | 'error'

export type CaptureNodeData = {
  // Inputs
  url: string
  selector?: string
  duration: number // seconds (1-10)
  
  // Capture state
  status: CaptureStatus
  progress?: number // 0-100
  currentFrame?: number
  totalFrames?: number
  elapsedTime?: number
  statusMessage?: string
  
  // Live preview
  sessionId?: string
  liveViewUrl?: string
  
  // Results
  videoUrl?: string         // Legacy: horizontal strip (deprecated)
  frameUrls?: string[]      // Individual frame URLs (new approach)
  captureId?: string
  excludedFrames?: number[] // Frame indices (0-based) to exclude from downstream nodes
  includeHtml?: boolean     // Whether to include scraped HTML in downstream prompts (default: true)
  animationContext?: {
    frames?: Array<{ timestamp: number; [key: string]: unknown }>
    keyframes?: Record<string, Array<{ offset: string; styles: string }>>
    libraries?: Record<string, boolean>
    computedStyles?: Record<string, string>
    html?: string
    boundingBox?: { x: number; y: number; width: number; height: number }
  }
  
  // Error
  error?: string
  
  // Callbacks
  onCapture?: (nodeId: string) => void
  onStop?: (nodeId: string) => void
}
