"use client"

import type React from "react"
import { createPortal, flushSync } from "react-dom"
import { useState, useCallback, useRef, useEffect, memo } from "react"
import { Handle, Position, type NodeProps, useReactFlow } from "@xyflow/react"
import { Play, Loader2, Check, AlertCircle, ChevronDown, RotateCcw, ImageIcon, FileText } from "lucide-react"

const IMAGE_GEN_MODELS = [
  { id: "google/gemini-3-pro-image", label: "Gemini 3 Pro Preview", provider: "google" },
  { id: "bfl/flux-2-pro", label: "Flux 2 Pro", provider: "bfl" },
  { id: "bfl/flux-kontext-pro", label: "Flux Kontext Pro", provider: "bfl" },
]

const TEXT_GEN_MODELS = [
  { id: "anthropic/claude-sonnet-4.5", label: "Claude Sonnet 4.5", provider: "anthropic" },
  { id: "openai/gpt-5.2", label: "GPT-5.2", provider: "openai" },
  { id: "google/gemini-3-flash", label: "Gemini 3 Flash", provider: "google" },
  { id: "anthropic/claude-haiku-4.5", label: "Claude Haiku 4.5", provider: "anthropic" },
  { id: "anthropic/claude-opus-4.5", label: "Claude Opus 4.5", provider: "anthropic" },
  { id: "xai/grok-code-fast-1", label: "Grok Code Fast 1", provider: "xai" },
  { id: "google/gemini-2.5-flash", label: "Gemini 2.5 Flash", provider: "google" },
]

function XAIIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M2.30047 8.77631L12.0474 23H16.3799L6.63183 8.77631H2.30047ZM6.6285 16.6762L2.29492 23H6.63072L8.79584 19.8387L6.6285 16.6762ZM17.3709 1L9.88007 11.9308L12.0474 15.0944L21.7067 1H17.3709ZM18.1555 7.76374V23H21.7067V2.5818L18.1555 7.76374Z"
        fill="currentColor"
      />
    </svg>
  )
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-3 h-3">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  )
}

function AnthropicIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-3 h-3">
      <path
        fill="#D97757"
        d="M13.827 3.52h3.603L24 20h-3.603l-6.57-16.48zm-7.258 0h3.767L16.906 20h-3.674l-1.343-3.461H5.017L3.673 20H0l6.569-16.48zm2.327 5.14L6.769 13.98h4.254L8.896 8.66z"
      />
    </svg>
  )
}

function OpenAIIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-3 h-3">
      <path
        fill="currentColor"
        d="M22.282 9.821a5.985 5.985 0 0 0-.516-4.91 6.046 6.046 0 0 0-6.51-2.9A6.065 6.065 0 0 0 4.981 4.18a5.985 5.985 0 0 0-3.998 2.9 6.046 6.046 0 0 0 .743 7.097 5.98 5.98 0 0 0 .51 4.911 6.051 6.051 0 0 0 6.515 2.9A5.985 5.985 0 0 0 13.26 24a6.056 6.056 0 0 0 5.772-4.206 5.99 5.99 0 0 0 3.997-2.9 6.056 6.056 0 0 0-.747-7.073zM13.26 22.43a4.476 4.476 0 0 1-2.876-1.04l.141-.081 4.779-2.758a.795.795 0 0 0 .392-.681v-6.737l2.02 1.168a.071.071 0 0 1 .038.052v5.583a4.504 4.504 0 0 1-4.494 4.494zM3.6 18.304a4.47 4.47 0 0 1-.535-3.014l.142.085 4.783 2.759a.771.771 0 0 0 .78 0l5.843-3.369v2.332a.08.08 0 0 1-.033.062L9.74 19.95a4.5 4.5 0 0 1-6.14-1.646zM2.34 7.896a4.485 4.485 0 0 1 2.366-1.973V11.6a.766.766 0 0 0 .388.676l5.815 3.355-2.02 1.168a.076.076 0 0 1-.071 0l-4.83-2.786A4.504 4.504 0 0 1 2.34 7.896zm16.597 3.855l-5.833-3.387L15.119 7.2a.076.076 0 0 1 .071 0l4.83 2.791a4.494 4.494 0 0 1-.676 8.105v-5.678a.79.79 0 0 0-.407-.667zm2.01-3.023l-.141-.085-4.774-2.782a.776.776 0 0 0-.785 0L9.409 9.23V6.897a.066.066 0 0 1 .028-.061l4.83-2.787a4.5 4.5 0 0 1 6.68 4.66zm-12.64 4.135l-2.02-1.164a.08.08 0 0 1-.038-.057V6.075a4.5 4.5 0 0 1 7.375-3.453l-.142.08-4.778 2.758a.795.795 0 0 0-.393.681zm1.097-2.365l2.602-1.5 2.607 1.5v2.999l-2.597 1.5-2.607-1.5z"
      />
    </svg>
  )
}

function BFLIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-3 h-3">
      <rect fill="#6366f1" width="24" height="24" rx="4" />
      <text x="12" y="16" fontSize="10" fill="white" textAnchor="middle" fontWeight="bold">
        F
      </text>
    </svg>
  )
}

function ProviderIcon({ provider }: { provider: string }) {
  switch (provider) {
    case "xai":
      return <XAIIcon />
    case "anthropic":
      return <AnthropicIcon />
    case "openai":
      return <OpenAIIcon />
    case "bfl":
      return <BFLIcon />
    case "google":
    default:
      return <GoogleIcon />
  }
}

export type PromptNodeData = {
  title: string
  prompt: string
  model?: string
  outputType?: "image" | "text"
  showAttachments?: boolean
  showResponse?: boolean
  status?: "idle" | "running" | "complete" | "error"
  onRun?: (nodeId: string, prompt: string, model: string) => void
}

export const PromptNode = memo(function PromptNode({ id, data, selected }: NodeProps) {
  const {
    title,
    prompt,
    model,
    outputType = "image",
    showAttachments = true,
    showResponse = true,
    status = "idle",
    onRun,
  } = data as PromptNodeData

  const MODEL_OPTIONS = outputType === "image" ? IMAGE_GEN_MODELS : TEXT_GEN_MODELS
  const defaultModel = MODEL_OPTIONS[0].id
  const currentModel = model || defaultModel

  const { setNodes } = useReactFlow()

  const [isEditingTitle, setIsEditingTitle] = useState(false)
  const [isEditingPrompt, setIsEditingPrompt] = useState(false)
  const [editedPrompt, setEditedPrompt] = useState(prompt)
  const [editedTitle, setEditedTitle] = useState(title)
  const [showModelDropdown, setShowModelDropdown] = useState(false)
  const [cardWidth, setCardWidth] = useState(320)
  const [cardHeight, setCardHeight] = useState<number | null>(null)
  const [isResizingX, setIsResizingX] = useState(false)
  const [isResizingY, setIsResizingY] = useState(false)
  const [isResizingXY, setIsResizingXY] = useState(false)

  const promptRef = useRef<HTMLTextAreaElement>(null)
  const titleRef = useRef<HTMLInputElement>(null)
  const dropdownTriggerRef = useRef<HTMLButtonElement>(null)
  const dropdownMenuRef = useRef<HTMLDivElement>(null)
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 })
  const cardRef = useRef<HTMLDivElement>(null)
  const startXRef = useRef(0)
  const startYRef = useRef(0)
  const startWidthRef = useRef(0)
  const startHeightRef = useRef(0)

  // Refs for latest values to avoid stale closures
  const latestPromptRef = useRef(editedPrompt)
  const latestModelRef = useRef(currentModel)
  latestPromptRef.current = editedPrompt
  latestModelRef.current = currentModel

  const handleTitleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    setIsEditingTitle(true)
  }, [])

  const handlePromptClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    setIsEditingPrompt(true)
  }, [])

  const handleSaveTitle = useCallback(() => {
    setIsEditingTitle(false)
    setNodes((nodes) =>
      nodes.map((node) => (node.id === id ? { ...node, data: { ...node.data, title: editedTitle } } : node)),
    )
  }, [id, editedTitle, setNodes])

  const handleSavePrompt = useCallback(() => {
    setIsEditingPrompt(false)
    setNodes((nodes) =>
      nodes.map((node) => (node.id === id ? { ...node, data: { ...node.data, prompt: editedPrompt } } : node)),
    )
  }, [id, editedPrompt, setNodes])

  const handleModelChange = useCallback(
    (newModel: string) => {
      setShowModelDropdown(false)
      setNodes((nodes) =>
        nodes.map((node) => (node.id === id ? { ...node, data: { ...node.data, model: newModel } } : node)),
      )
    },
    [id, setNodes],
  )

  const handleRun = useCallback(() => {
    if (onRun && status === "idle") {
      onRun(id, editedPrompt, currentModel)
    }
  }, [id, editedPrompt, currentModel, onRun, status])

  const handleRetry = useCallback(() => {
    if (onRun && (status === "complete" || status === "error")) {
      // Use flushSync to ensure state update completes before calling onRun
      // This eliminates the need for a magic timeout and avoids race conditions
      flushSync(() => {
        setNodes((nodes) =>
          nodes.map((node) => (node.id === id ? { ...node, data: { ...node.data, status: "idle" } } : node)),
        )
      })
      // Use refs to get latest values, avoiding stale closure issues
      onRun(id, latestPromptRef.current, latestModelRef.current)
    }
  }, [id, onRun, status, setNodes])

  const selectedModel = MODEL_OPTIONS.find((m) => m.id === currentModel) || MODEL_OPTIONS[0]

  const StatusIcon = () => {
    switch (status) {
      case "running":
        return <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
      case "complete":
        return <Check className="w-4 h-4 text-emerald-500" />
      case "error":
        return <AlertCircle className="w-4 h-4 text-red-500" />
      default:
        return null
    }
  }

  const handleToggleDropdown = useCallback(() => {
    if (!showModelDropdown && dropdownTriggerRef.current) {
      const rect = dropdownTriggerRef.current.getBoundingClientRect()
      setDropdownPosition({
        top: rect.bottom + 4,
        left: rect.left,
      })
    }
    setShowModelDropdown(!showModelDropdown)
  }, [showModelDropdown])

  useEffect(() => {
    if (showModelDropdown) {
      const handleClickOutside = (e: MouseEvent) => {
        const target = e.target as Node
        const isInsideTrigger = dropdownTriggerRef.current?.contains(target)
        const isInsideMenu = dropdownMenuRef.current?.contains(target)
        
        if (!isInsideTrigger && !isInsideMenu) {
          setShowModelDropdown(false)
        }
      }
      document.addEventListener("mousedown", handleClickOutside)
      return () => document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [showModelDropdown])

  const handleResizeXStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setIsResizingX(true)
      startXRef.current = e.clientX
      startWidthRef.current = cardWidth
    },
    [cardWidth],
  )

  const handleResizeYStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setIsResizingY(true)
      startYRef.current = e.clientY
      startHeightRef.current = cardHeight || cardRef.current?.offsetHeight || 300
    },
    [cardHeight],
  )

  const handleResizeXYStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setIsResizingXY(true)
      startXRef.current = e.clientX
      startYRef.current = e.clientY
      startWidthRef.current = cardWidth
      startHeightRef.current = cardHeight || cardRef.current?.offsetHeight || 300
    },
    [cardWidth, cardHeight],
  )

  useEffect(() => {
    if (!isResizingX && !isResizingY && !isResizingXY) return

    const handleMouseMove = (e: MouseEvent) => {
      if (isResizingX || isResizingXY) {
        const deltaX = e.clientX - startXRef.current
        const newWidth = Math.max(280, Math.min(600, startWidthRef.current + deltaX))
        setCardWidth(newWidth)
      }
      if (isResizingY || isResizingXY) {
        const deltaY = e.clientY - startYRef.current
        const newHeight = Math.max(200, Math.min(800, startHeightRef.current + deltaY))
        setCardHeight(newHeight)
      }
    }

    const handleMouseUp = () => {
      setIsResizingX(false)
      setIsResizingY(false)
      setIsResizingXY(false)
    }

    document.addEventListener("mousemove", handleMouseMove)
    document.addEventListener("mouseup", handleMouseUp)
    return () => {
      document.removeEventListener("mousemove", handleMouseMove)
      document.removeEventListener("mouseup", handleMouseUp)
    }
  }, [isResizingX, isResizingY, isResizingXY])

  return (
    <div
      ref={cardRef}
      style={{ width: cardWidth, ...(cardHeight ? { height: cardHeight } : {}) }}
      className={`bg-card rounded-2xl shadow-md transition-all relative flex flex-col ${selected ? "ring-2 ring-node-selected" : ""}`}
    >
      <Handle type="target" position={Position.Left} className="!w-3 !h-3 !bg-node-handle !border-2 !border-card" />

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2 flex-1">
          <div className="w-5 h-5 rounded-full bg-card border border-border flex items-center justify-center">
            {outputType === "image" ? (
              <ImageIcon className="w-3 h-3 text-violet-500" />
            ) : (
              <FileText className="w-3 h-3 text-blue-500" />
            )}
          </div>
          {isEditingTitle ? (
            <input
              ref={titleRef}
              type="text"
              value={editedTitle}
              onChange={(e) => setEditedTitle(e.target.value)}
              onBlur={handleSaveTitle}
              onKeyDown={(e) => e.key === "Enter" && handleSaveTitle()}
              className="text-sm font-medium text-card-foreground bg-transparent border-b border-info outline-none flex-1"
            />
          ) : (
            <span
              className="text-sm font-medium text-card-foreground cursor-text hover:text-info transition-colors"
              onClick={handleTitleClick}
            >
              {title}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <StatusIcon />
          {(status === "complete" || status === "error") && (
            <button
              onClick={handleRetry}
              className="p-1.5 rounded-lg hover:bg-muted transition-colors"
              title="Retry this node"
            >
              <RotateCcw className="w-4 h-4 text-muted-foreground" />
            </button>
          )}
          <button
            onClick={handleRun}
            disabled={status === "running"}
            className="p-1.5 rounded-lg hover:bg-muted transition-colors disabled:opacity-50"
            title="Run this node"
          >
            <Play className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>
      </div>

      <div className="px-4 pt-3 relative">
        <button
          ref={dropdownTriggerRef}
          onClick={handleToggleDropdown}
          className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <ProviderIcon provider={selectedModel.provider} />
          <span className="bg-muted px-2 py-1 rounded-md">{selectedModel.label}</span>
          <ChevronDown className="w-3 h-3" />
        </button>
        {showModelDropdown &&
          typeof window !== "undefined" &&
          createPortal(
            <div
              ref={dropdownMenuRef}
              className="fixed bg-popover border border-border rounded-lg shadow-lg z-[9999] min-w-[200px]"
              style={{ top: dropdownPosition.top, left: dropdownPosition.left }}
            >
              {MODEL_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => handleModelChange(opt.id)}
                  className={`flex items-center gap-2 w-full text-left px-3 py-2 text-xs hover:bg-muted first:rounded-t-lg last:rounded-b-lg ${opt.id === currentModel ? "bg-muted font-medium" : ""}`}
                >
                  <ProviderIcon provider={opt.provider} />
                  {opt.label}
                </button>
              ))}
            </div>,
            document.body,
          )}
      </div>

      {/* Prompt Area */}
      <div className="p-4 pt-2 flex-1 flex flex-col min-h-0">
        <div
          className={`bg-muted border rounded-lg p-3 transition-colors flex-1 overflow-auto ${
            isEditingPrompt
              ? "border-info bg-card ring-2 ring-info/20"
              : "border-border cursor-text hover:border-info/50 hover:bg-info/5"
          }`}
          onClick={!isEditingPrompt ? handlePromptClick : undefined}
        >
          {isEditingPrompt ? (
            <textarea
              ref={promptRef}
              value={editedPrompt}
              onChange={(e) => setEditedPrompt(e.target.value)}
              onBlur={handleSavePrompt}
              onKeyDown={(e) => {
                if (e.key === "Escape") handleSavePrompt()
              }}
              className="text-xs text-muted-foreground leading-relaxed w-full h-full bg-transparent outline-none resize-none min-h-[120px]"
              placeholder="Enter your prompt..."
            />
          ) : (
            <p className="text-xs text-muted-foreground leading-relaxed min-h-[60px] whitespace-pre-wrap">
              {prompt || <span className="text-muted-foreground/50 italic">Click to add prompt...</span>}
            </p>
          )}
        </div>
      </div>

      {/* Footer Labels */}
      <div className="flex items-center gap-4 px-4 pb-3">
        {showAttachments && (
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-warning" />
            <span className="text-xs text-muted-foreground">Attachments</span>
          </div>
        )}
        {showResponse && (
          <div className="flex items-center gap-1.5">
            <div
              className={`w-1.5 h-1.5 rounded-full ${status === "complete" ? "bg-success" : status === "error" ? "bg-destructive" : "bg-warning"}`}
            />
            <span className="text-xs text-muted-foreground">Response</span>
          </div>
        )}
        <div className="ml-auto">
          <span
            className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${outputType === "image" ? "bg-violet-500/20 text-violet-400" : "bg-blue-500/20 text-blue-400"}`}
          >
            {outputType === "image" ? "→ Image" : "→ Text"}
          </span>
        </div>
      </div>

      {/* Resize Handles */}
      <div
        onMouseDown={handleResizeXStart}
        className="absolute right-0 top-0 bottom-2 w-2 cursor-ew-resize hover:bg-info/20 transition-colors"
      />
      <div
        onMouseDown={handleResizeYStart}
        className="absolute bottom-0 left-0 right-2 h-2 cursor-ns-resize hover:bg-info/20 transition-colors"
      />
      <div
        onMouseDown={handleResizeXYStart}
        className="absolute bottom-0 right-0 w-3 h-3 cursor-nwse-resize hover:bg-info/30 transition-colors"
      />

      <Handle type="source" position={Position.Right} className="!w-3 !h-3 !bg-node-handle !border-2 !border-card" />
    </div>
  )
})
