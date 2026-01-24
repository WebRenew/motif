"use client"

import { memo, useState, useCallback, useRef, useEffect } from "react"
import { Handle, Position, type NodeProps, useReactFlow } from "@xyflow/react"
import { Play, Square, Loader2, Check, AlertCircle, ExternalLink, Video, RefreshCw } from "lucide-react"
import type { CaptureNodeData } from "@/lib/types/workflow"

export const CaptureNode = memo(function CaptureNode({ id, data, selected }: NodeProps) {
  const {
    url = "",
    selector = "",
    duration = 3,
    status = "idle",
    progress = 0,
    currentFrame = 0,
    totalFrames = 30,
    statusMessage = "",
    liveViewUrl,
    videoUrl,
    error,
    onCapture,
    onStop,
  } = data as CaptureNodeData

  const { setNodes } = useReactFlow()
  const [editedUrl, setEditedUrl] = useState(url)
  const [editedSelector, setEditedSelector] = useState(selector)
  const [editedDuration, setEditedDuration] = useState(duration)
  const abortControllerRef = useRef<AbortController | null>(null)

  // Sync local state when data changes externally
  useEffect(() => {
    setEditedUrl(url)
    setEditedSelector(selector)
    setEditedDuration(duration)
  }, [url, selector, duration])

  const updateNodeData = useCallback(
    (updates: Partial<CaptureNodeData>) => {
      setNodes((nodes) =>
        nodes.map((node) =>
          node.id === id ? { ...node, data: { ...node.data, ...updates } } : node
        )
      )
    },
    [id, setNodes]
  )

  const handleUrlChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value
      setEditedUrl(value)
      updateNodeData({ url: value })
    },
    [updateNodeData]
  )

  const handleSelectorChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value
      setEditedSelector(value)
      updateNodeData({ selector: value })
    },
    [updateNodeData]
  )

  const handleDurationChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = Number(e.target.value)
      setEditedDuration(value)
      updateNodeData({ duration: value })
    },
    [updateNodeData]
  )

  const handleCapture = useCallback(() => {
    if (onCapture) {
      onCapture(id)
    }
  }, [id, onCapture])

  const handleStop = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    if (onStop) {
      onStop(id)
    }
  }, [id, onStop])

  const handleRetry = useCallback(() => {
    updateNodeData({ status: "idle", error: undefined, progress: 0 })
  }, [updateNodeData])

  const isCapturing = status === "connecting" || status === "live" || status === "capturing"
  const canCapture = status === "idle" || status === "complete" || status === "error"

  const getStatusIcon = () => {
    switch (status) {
      case "connecting":
      case "live":
      case "capturing":
        return <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
      case "complete":
        return <Check className="w-4 h-4 text-emerald-500" />
      case "error":
        return <AlertCircle className="w-4 h-4 text-red-500" />
      default:
        return null
    }
  }

  const getStatusText = () => {
    switch (status) {
      case "connecting":
        return "Connecting to browser..."
      case "live":
        return "Browser ready"
      case "capturing":
        return statusMessage || `Capturing frame ${currentFrame}/${totalFrames}...`
      case "complete":
        return "Capture complete"
      case "error":
        return error || "Capture failed"
      default:
        return "Ready to capture"
    }
  }

  return (
    <div
      className={`bg-card rounded-2xl shadow-md transition-all w-[320px] ${
        selected ? "ring-2 ring-node-selected" : ""
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-red-500/20 flex items-center justify-center">
            <Video className="w-3.5 h-3.5 text-red-500" />
          </div>
          <span className="text-sm font-medium text-card-foreground">Animation Capture</span>
        </div>
        <div className="flex items-center gap-2">
          {getStatusIcon()}
          {(status === "complete" || status === "error") && (
            <button
              onClick={handleRetry}
              className="p-1.5 rounded-lg hover:bg-muted transition-colors"
              title="Reset"
            >
              <RefreshCw className="w-4 h-4 text-muted-foreground" />
            </button>
          )}
        </div>
      </div>

      {/* URL Input */}
      <div className="px-4 pt-3">
        <label className="text-xs text-muted-foreground mb-1 block">URL</label>
        <input
          type="url"
          value={editedUrl}
          onChange={handleUrlChange}
          placeholder="https://example.com"
          disabled={isCapturing}
          className="w-full px-3 py-2 text-sm bg-muted border border-border rounded-lg outline-none focus:border-info focus:ring-1 focus:ring-info/20 disabled:opacity-50"
        />
      </div>

      {/* Selector Input (collapsible) */}
      <div className="px-4 pt-2">
        <label className="text-xs text-muted-foreground mb-1 block">CSS Selector (optional)</label>
        <input
          type="text"
          value={editedSelector}
          onChange={handleSelectorChange}
          placeholder=".hero-animation"
          disabled={isCapturing}
          className="w-full px-3 py-2 text-sm bg-muted border border-border rounded-lg outline-none focus:border-info focus:ring-1 focus:ring-info/20 disabled:opacity-50"
        />
      </div>

      {/* Duration Slider */}
      <div className="px-4 pt-2">
        <div className="flex items-center justify-between mb-1">
          <label className="text-xs text-muted-foreground">Duration</label>
          <span className="text-xs text-muted-foreground">{editedDuration}s</span>
        </div>
        <input
          type="range"
          min={1}
          max={10}
          step={1}
          value={editedDuration}
          onChange={handleDurationChange}
          disabled={isCapturing}
          className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-red-500 disabled:opacity-50"
        />
      </div>

      {/* Video Preview / Status Area */}
      <div className="px-4 pt-3">
        <div className="relative bg-muted rounded-lg overflow-hidden aspect-video flex items-center justify-center">
          {videoUrl ? (
            // Show captured video
            <video
              src={videoUrl}
              controls
              className="w-full h-full object-cover"
              poster={videoUrl.endsWith('.jpg') || videoUrl.endsWith('.jpeg') ? videoUrl : undefined}
            />
          ) : status === "idle" ? (
            // Empty state
            <div className="text-center p-4">
              <Video className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-xs text-muted-foreground/50">
                Enter a URL and click Capture
              </p>
            </div>
          ) : isCapturing ? (
            // Progress indicator
            <div className="text-center p-4 w-full">
              <Loader2 className="w-8 h-8 text-red-500 animate-spin mx-auto mb-2" />
              <p className="text-xs text-muted-foreground mb-2">{getStatusText()}</p>
              {status === "capturing" && (
                <div className="w-full bg-border rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-red-500 h-full transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              )}
            </div>
          ) : status === "error" ? (
            // Error state
            <div className="text-center p-4">
              <AlertCircle className="w-8 h-8 text-red-500/50 mx-auto mb-2" />
              <p className="text-xs text-red-500">{error || "Capture failed"}</p>
            </div>
          ) : null}

          {/* Live view link */}
          {liveViewUrl && isCapturing && (
            <a
              href={liveViewUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="absolute top-2 right-2 flex items-center gap-1 px-2 py-1 bg-black/50 text-white text-xs rounded hover:bg-black/70 transition-colors"
            >
              <ExternalLink className="w-3 h-3" />
              Live View
            </a>
          )}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {canCapture ? (
            <button
              onClick={handleCapture}
              disabled={!editedUrl}
              className="flex items-center gap-2 px-4 py-2 bg-red-500 text-white text-sm font-medium rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Play className="w-4 h-4" />
              Capture
            </button>
          ) : (
            <button
              onClick={handleStop}
              className="flex items-center gap-2 px-4 py-2 bg-muted text-foreground text-sm font-medium rounded-lg hover:bg-muted/80 transition-colors"
            >
              <Square className="w-4 h-4" />
              Stop
            </button>
          )}
        </div>

        <span className="text-xs text-muted-foreground">{getStatusText()}</span>
      </div>

      {/* Output Handle */}
      <Handle
        type="source"
        position={Position.Right}
        className="!w-3 !h-3 !bg-red-500 !border-2 !border-card"
      />
    </div>
  )
})
