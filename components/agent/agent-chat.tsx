"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { useChat } from "@ai-sdk/react"
import { DefaultChatTransport, isToolUIPart, getToolName } from "ai"
import { X, ArrowUp, Loader2, Minimize2, Maximize2, Paperclip, FileText } from "lucide-react"
import { OutletIcon } from "@/components/icons/outlet"
import { useAuth } from "@/lib/context/auth-context"
import { cn } from "@/lib/utils"
import { processToolResult, requestCanvasState } from "@/lib/agent/bridge"
import { toast } from "sonner"
import {
  getOrCreateConversation,
  loadConversation,
  saveMessage,
  type Message as DbMessage,
} from "@/lib/supabase/conversations"
import { MarkdownRenderer } from "@/components/agent/markdown-renderer"

// File upload constraints
const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB
const MAX_FILES = 5

// Chat panel size constraints
const MIN_WIDTH = 400
const MAX_WIDTH_MARGIN = 80 // margin from viewport edge (matches left-20 = 80px)
const FRAME_OFFSET = 16 // 4 in Tailwind = 16px (left-4, bottom-4)
const MIN_HEIGHT = 400
const DEFAULT_HEIGHT = 600
const LOGO_HEIGHT = 56 // approximate logo height
const TOP_MARGIN = 20 // 20px below logo
const ALLOWED_TYPES = [
  "text/plain",
  "text/markdown",
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
]
const ALLOWED_EXTENSIONS = [".txt", ".md", ".pdf", ".jpg", ".jpeg", ".png", ".gif", ".webp"]

// Hook to handle viewport resize when maximized
function useMaximizedResize(
  isMaximized: boolean,
  getFullWidth: () => number,
  getFullHeight: () => number,
  setPanelSize: (size: { width: number; height: number }) => void
) {
  useEffect(() => {
    if (!isMaximized) return
    
    const handleWindowResize = () => {
      setPanelSize({ width: getFullWidth(), height: getFullHeight() })
    }
    
    window.addEventListener("resize", handleWindowResize)
    return () => window.removeEventListener("resize", handleWindowResize)
  }, [isMaximized, getFullWidth, getFullHeight, setPanelSize])
}

interface UploadedFile {
  id: string
  file: File
  preview?: string // For images
  type: "image" | "document"
}

interface AgentChatProps {
  workflowId?: string
}

export function AgentChat({ workflowId }: AgentChatProps) {
  const { user } = useAuth()
  const [isOpen, setIsOpen] = useState(false)
  const [isMaximized, setIsMaximized] = useState(false)
  const [input, setInput] = useState("")
  const [glowPosition, setGlowPosition] = useState({ x: 50, y: 50 })
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([])
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [lightboxFile, setLightboxFile] = useState<UploadedFile | null>(null)
  
  // Conversation persistence state
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [initialMessages, setInitialMessages] = useState<Array<{ id: string; role: "user" | "assistant"; content: string }>>([])
  const conversationLoadedRef = useRef(false)
  const lastSavedMessageCountRef = useRef(0)
  
  // Resize state
  const [panelSize, setPanelSize] = useState({ width: MIN_WIDTH, height: DEFAULT_HEIGHT })
  const [previousSize, setPreviousSize] = useState({ width: MIN_WIDTH, height: DEFAULT_HEIGHT })
  const [isResizing, setIsResizing] = useState<"width" | "height" | "both" | null>(null)
  const resizeStartRef = useRef({ x: 0, y: 0, width: 0, height: 0 })
  
  // Get user avatar URL from auth
  const userAvatarUrl = user?.user_metadata?.avatar_url || user?.user_metadata?.picture
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const chatPanelRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  // Track processed tool calls to avoid duplicate dispatches
  const processedToolCallsRef = useRef<Set<string>>(new Set())

  // Track file preview URLs for cleanup on unmount
  const filePreviewsRef = useRef<Set<string>>(new Set())
  
  // Use the AI SDK useChat hook
  const { messages, sendMessage, status, setMessages } = useChat({
    transport: new DefaultChatTransport({
      api: "/api/agent/chat",
    }),
  })
  
  const isLoading = status === "streaming" || status === "submitted"
  
  // Reset conversation when workflowId changes (e.g., navigating to different workflow)
  useEffect(() => {
    // Reset state to allow re-initialization with new workflowId
    conversationLoadedRef.current = false
    setConversationId(null)
    lastSavedMessageCountRef.current = 0
    setMessages([])
  }, [workflowId, setMessages])
  
  // Load or create conversation when chat opens
  useEffect(() => {
    if (!isOpen || !user?.id || conversationLoadedRef.current) return
    
    const initConversation = async () => {
      try {
        // Get or create conversation
        const convId = await getOrCreateConversation(user.id, workflowId)
        setConversationId(convId)
        
        // Load existing messages
        const conversation = await loadConversation(convId)
        if (conversation && conversation.messages.length > 0) {
          // Convert DB messages to AI SDK format
          const aiMessages = conversation.messages.map((m, idx) => ({
            id: `db-${convId}-${idx}`,
            role: m.role as "user" | "assistant",
            content: m.content,
            parts: [{ type: "text" as const, text: m.content }],
          }))
          setMessages(aiMessages)
          lastSavedMessageCountRef.current = aiMessages.length
        }
        
        conversationLoadedRef.current = true
      } catch (error) {
        console.error("Failed to load conversation:", error)
      }
    }
    
    initConversation()
  }, [isOpen, user?.id, workflowId, setMessages])
  
  // Save new messages after streaming completes
  useEffect(() => {
    if (!conversationId || isLoading) return
    
    // Check if there are new messages to save
    const newMessageCount = messages.length
    const savedCount = lastSavedMessageCountRef.current
    
    if (newMessageCount <= savedCount) return
    
    // Save only the new messages
    const saveNewMessages = async () => {
      const messagesToSave = messages.slice(savedCount)
      
      for (const msg of messagesToSave) {
        // Extract text content from parts
        let content = ""
        for (const part of msg.parts) {
          if (part.type === "text") {
            content += part.text
          }
        }
        
        if (!content) continue
        
        const dbMessage: DbMessage = {
          role: msg.role as "user" | "assistant",
          content,
        }
        
        try {
          await saveMessage(conversationId, dbMessage)
        } catch (error) {
          console.error("Failed to save message:", error)
        }
      }
      
      lastSavedMessageCountRef.current = newMessageCount
    }
    
    saveNewMessages()
  }, [conversationId, messages, isLoading])
  
  // Process tool results when messages update
  useEffect(() => {
    for (const message of messages) {
      if (message.role !== "assistant") continue
      
      for (const part of message.parts) {
        // Check for tool parts using the helper
        if (isToolUIPart(part) && part.state === "output-available") {
          const toolCallId = part.toolCallId
          
          // Skip if already processed
          if (processedToolCallsRef.current.has(toolCallId)) continue
          processedToolCallsRef.current.add(toolCallId)
          
          // Dispatch to canvas
          const toolName = getToolName(part)
          const result = part.output
          
          if (result && typeof result === "object") {
            processToolResult(toolName, result as Parameters<typeof processToolResult>[1])
          }
        }
      }
    }
  }, [messages])
  
  // Calculate max dimensions
  const getMaxWidth = useCallback(() => {
    if (typeof window === "undefined") return 800
    return window.innerWidth - MAX_WIDTH_MARGIN - 16 // 16px for right margin
  }, [])
  
  const getMaxHeight = useCallback(() => {
    if (typeof window === "undefined") return 700
    return window.innerHeight - LOGO_HEIGHT - TOP_MARGIN - 16 - 16 // 16px top, 16px bottom
  }, [])
  
  // Full viewport size minus frame offsets (for maximize)
  const getFullWidth = useCallback(() => {
    if (typeof window === "undefined") return 800
    return window.innerWidth - FRAME_OFFSET * 2 // left-4 and right-4 equivalent
  }, [])
  
  const getFullHeight = useCallback(() => {
    if (typeof window === "undefined") return 700
    return window.innerHeight - FRAME_OFFSET * 2 // top-4 and bottom-4 equivalent
  }, [])
  
  // Toggle maximize
  const toggleMaximize = useCallback(() => {
    if (isMaximized) {
      // Restore previous size
      setPanelSize(previousSize)
      setIsMaximized(false)
    } else {
      // Save current size and maximize to full viewport minus frame offset
      setPreviousSize(panelSize)
      setPanelSize({ width: getFullWidth(), height: getFullHeight() })
      setIsMaximized(true)
    }
  }, [isMaximized, panelSize, previousSize, getFullWidth, getFullHeight])
  
  // Minimize (close) and reset to default size
  const handleMinimize = useCallback(() => {
    const defaultSize = { width: MIN_WIDTH, height: DEFAULT_HEIGHT }
    setPanelSize(defaultSize)
    setPreviousSize(defaultSize)
    setIsMaximized(false)
    setIsOpen(false)
  }, [])
  
  // Check if panel is larger than default size
  const isLargerThanDefault = panelSize.width > MIN_WIDTH || panelSize.height > DEFAULT_HEIGHT
  
  // Reset to default size
  const handleResetSize = useCallback(() => {
    setPanelSize({ width: MIN_WIDTH, height: DEFAULT_HEIGHT })
    setPreviousSize({ width: MIN_WIDTH, height: DEFAULT_HEIGHT })
    setIsMaximized(false)
  }, [])
  
  // Handle viewport resize when maximized
  useMaximizedResize(isMaximized, getFullWidth, getFullHeight, setPanelSize)
  
  // Resize handlers
  const handleResizeStart = useCallback((e: React.MouseEvent, direction: "width" | "height" | "both") => {
    e.preventDefault()
    setIsResizing(direction)
    resizeStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      width: panelSize.width,
      height: panelSize.height,
    }
  }, [panelSize])
  
  useEffect(() => {
    if (!isResizing) return
    
    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - resizeStartRef.current.x
      const deltaY = resizeStartRef.current.y - e.clientY // inverted because we resize from top
      
      setPanelSize((prev) => {
        const maxWidth = getMaxWidth()
        const maxHeight = getMaxHeight()
        
        let newWidth = prev.width
        let newHeight = prev.height
        
        if (isResizing === "width" || isResizing === "both") {
          newWidth = Math.min(maxWidth, Math.max(MIN_WIDTH, resizeStartRef.current.width + deltaX))
        }
        if (isResizing === "height" || isResizing === "both") {
          newHeight = Math.min(maxHeight, Math.max(MIN_HEIGHT, resizeStartRef.current.height + deltaY))
        }
        
        return { width: newWidth, height: newHeight }
      })
    }
    
    const handleMouseUp = () => {
      setIsResizing(null)
    }
    
    document.addEventListener("mousemove", handleMouseMove)
    document.addEventListener("mouseup", handleMouseUp)
    
    return () => {
      document.removeEventListener("mousemove", handleMouseMove)
      document.removeEventListener("mouseup", handleMouseUp)
    }
  }, [isResizing, getMaxWidth, getMaxHeight])

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  // Focus input when chat opens
  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus()
    }
  }, [isOpen])

  // Keyboard shortcut: Cmd+J to toggle chat
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "j" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setIsOpen((prev) => !prev)
      }
    }
    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [])

  // Track created preview URLs
  useEffect(() => {
    uploadedFiles.forEach((f) => {
      if (f.preview) filePreviewsRef.current.add(f.preview)
    })
  }, [uploadedFiles])

  // Cleanup all file previews on unmount only
  useEffect(() => {
    const previewsRef = filePreviewsRef
    return () => {
      previewsRef.current.forEach((url) => URL.revokeObjectURL(url))
      previewsRef.current.clear()
    }
  }, [])

  // Track mouse position for glow effect (only inside chat panel)
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!chatPanelRef.current || messages.length > 0) return
    
    const rect = chatPanelRef.current.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * 100
    const y = ((e.clientY - rect.top) / rect.height) * 100
    
    setGlowPosition({ x, y })
  }, [messages.length])

  // Validate and process files
  const processFiles = useCallback((files: FileList | File[]) => {
    setUploadError(null)
    const fileArray = Array.from(files)
    
    // Check max files limit
    if (uploadedFiles.length + fileArray.length > MAX_FILES) {
      setUploadError(`Maximum ${MAX_FILES} files allowed`)
      return
    }

    const validFiles: UploadedFile[] = []
    
    for (const file of fileArray) {
      // Check file size
      if (file.size > MAX_FILE_SIZE) {
        setUploadError(`${file.name} exceeds 5MB limit`)
        continue
      }

      // Check file type
      const extension = `.${file.name.split(".").pop()?.toLowerCase()}`
      const isValidType = ALLOWED_TYPES.includes(file.type) || ALLOWED_EXTENSIONS.includes(extension)
      
      if (!isValidType) {
        setUploadError(`${file.name} is not a supported file type`)
        continue
      }

      const isImage = file.type.startsWith("image/")
      const uploadedFile: UploadedFile = {
        id: crypto.randomUUID(),
        file,
        type: isImage ? "image" : "document",
        preview: isImage ? URL.createObjectURL(file) : undefined,
      }
      
      validFiles.push(uploadedFile)
    }

    if (validFiles.length > 0) {
      setUploadedFiles((prev) => [...prev, ...validFiles])
    }
  }, [uploadedFiles.length])

  // Handle paste for images
  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items
    if (!items) return

    const files: File[] = []
    for (const item of items) {
      if (item.kind === "file") {
        const file = item.getAsFile()
        if (file) files.push(file)
      }
    }

    if (files.length > 0) {
      e.preventDefault()
      processFiles(files)
    }
  }, [processFiles])

  // Handle file input change
  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFiles(e.target.files)
      e.target.value = "" // Reset input
    }
  }, [processFiles])

  // Remove uploaded file
  const removeFile = useCallback((id: string) => {
    setUploadedFiles((prev) => {
      const file = prev.find((f) => f.id === id)
      if (file?.preview) {
        URL.revokeObjectURL(file.preview)
        filePreviewsRef.current.delete(file.preview)
      }
      return prev.filter((f) => f.id !== id)
    })
    setUploadError(null)
  }, [])

  const handleSubmit = useCallback(async (e?: React.FormEvent) => {
    e?.preventDefault()
    
    const trimmedInput = input.trim()
    if ((!trimmedInput && uploadedFiles.length === 0) || isLoading) return

    // Convert files to FileUIPart format for AI SDK
    const files: Array<{ type: 'file'; mediaType: string; filename: string; url: string }> = []
    
    for (const uploadedFile of uploadedFiles) {
      try {
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = () => resolve(reader.result as string)
          reader.onerror = reject
          reader.readAsDataURL(uploadedFile.file)
        })
        
        files.push({
          type: 'file',
          mediaType: uploadedFile.file.type,
          filename: uploadedFile.file.name,
          url: dataUrl,
        })
      } catch (error) {
        console.error("Failed to read file:", uploadedFile.file.name, error)
      }
    }

    // Clear uploaded files after processing
    uploadedFiles.forEach((f) => {
      if (f.preview) {
        URL.revokeObjectURL(f.preview)
        filePreviewsRef.current.delete(f.preview)
      }
    })
    setUploadedFiles([])
    setInput("")
    
    // Get current canvas state to provide context
    const canvasState = await requestCanvasState()
    
    // Build message with canvas context
    let messageText = trimmedInput
    if (canvasState.nodes.length > 0 || canvasState.edges.length > 0) {
      const stateContext = `[Current Canvas State]
Nodes (${canvasState.nodes.length}):
${canvasState.nodes.map(n => `- ${n.id} (${n.type}) at (${n.position.x}, ${n.position.y})`).join('\n')}
Edges (${canvasState.edges.length}):
${canvasState.edges.map(e => `- ${e.source} → ${e.target}`).join('\n')}

[User Request]
${trimmedInput}`
      messageText = stateContext
    }
    
    // Use the useChat sendMessage function with files
    try {
      await sendMessage({ 
        text: messageText,
        files: files.length > 0 ? files : undefined,
      })
    } catch (error) {
      // Handle rate limit and other errors
      const message = error instanceof Error ? error.message : "Failed to send message"
      toast.error("Message failed", { description: message })
    }
  }, [input, isLoading, uploadedFiles, sendMessage])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  // Helper to extract text content from message parts
  const getMessageText = useCallback((message: (typeof messages)[number]): string => {
    let text = ""
    for (const part of message.parts) {
      if (part.type === "text") {
        text += part.text
      }
    }

    // For user messages, strip the canvas context prefix and only show the actual request
    if (message.role === "user" && text.includes("[User Request]")) {
      const requestMatch = text.match(/\[User Request\]\s*([\s\S]*)$/)
      if (requestMatch) {
        return requestMatch[1].trim()
      }
    }

    return text
  }, [])

  // Floating button when closed
  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 left-4 z-50 flex items-center justify-center w-9 h-9 rounded-xl bg-primary border border-muted-foreground/20 backdrop-blur-md"
        style={{ boxShadow: "inset 0 2px 8px rgba(168, 85, 247, 0.15), 0 10px 15px -3px rgba(0, 0, 0, 0.1)" }}
        aria-label="Open chat"
      >
        <OutletIcon className="w-4 h-4 text-primary-foreground" animated />
      </button>
    )
  }

  // Full chat panel
  return (
    <div 
      ref={chatPanelRef}
      onMouseMove={handleMouseMove}
      className={cn(
        "agent-chat-panel fixed bottom-4 left-4 flex flex-col rounded-[20px] bg-[#111114] border border-white/5 shadow-[0_4px_24px_rgba(0,0,0,0.4),inset_0_0_0_1px_rgba(255,255,255,0.02)] overflow-hidden",
        !isResizing && "animate-in slide-in-from-bottom-4 duration-200",
        isMaximized ? "z-[2147483647]" : "z-50"
      )}
      style={{
        width: panelSize.width,
        height: panelSize.height,
      }}
    >
      {/* Resize handle - top right corner */}
      <div
        onMouseDown={(e) => handleResizeStart(e, "both")}
        className="absolute top-0 right-0 w-6 h-6 cursor-ne-resize z-20 group"
      >
        <div className="absolute top-1.5 right-1.5 w-3 h-3 border-t-2 border-r-2 border-white/10 group-hover:border-white/30 rounded-tr transition-colors" />
      </div>
      
      {/* Resize handle - right edge */}
      <div
        onMouseDown={(e) => handleResizeStart(e, "width")}
        className="absolute top-6 right-0 bottom-0 w-2 cursor-ew-resize z-20 hover:bg-white/5 transition-colors"
      />
      
      {/* Resize handle - top edge */}
      <div
        onMouseDown={(e) => handleResizeStart(e, "height")}
        className="absolute top-0 left-0 right-6 h-2 cursor-ns-resize z-20 hover:bg-white/5 transition-colors"
      />
      
      {/* Top gradient border */}
      <div className="pointer-events-none absolute left-0 right-0 top-0 h-px rounded-t-[20px] bg-gradient-to-r from-transparent via-[#C157C1]/40 to-transparent" />
      
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
        <div className="flex items-center gap-2">
          {messages.length > 0 && (
            <div 
              className="flex items-center justify-center w-8 h-8 rounded-lg bg-[#161619] border border-white/5"
              style={{ boxShadow: "inset 0 1px 2px rgba(255, 255, 255, 0.05)" }}
            >
              <OutletIcon className="w-4 h-4 text-[#f0f0f2]" animated />
            </div>
          )}
          <div>
            <h3 className="text-sm font-medium text-[#f0f0f2]">Workflow Agent</h3>
            <p className="text-xs text-[#8a8a94]">Powered by Claude Opus</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {isLargerThanDefault && (
            <button
              onClick={handleResetSize}
              className="p-2 hover:bg-white/5 rounded-lg transition-colors"
              aria-label="Reset to default size"
            >
              <Minimize2 className="w-4 h-4 text-[#8a8a94]" />
            </button>
          )}
          <button
            onClick={toggleMaximize}
            className="p-2 hover:bg-white/5 rounded-lg transition-colors"
            aria-label={isMaximized ? "Restore size" : "Maximize chat"}
          >
            <Maximize2 className={cn("w-4 h-4 text-[#8a8a94]", isMaximized && "rotate-180")} />
          </button>
          <button
            onClick={handleMinimize}
            className="p-2 hover:bg-white/5 rounded-lg transition-colors"
            aria-label="Minimize chat"
          >
            <X className="w-4 h-4 text-[#8a8a94]" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className={cn(
        "flex-1 p-4 space-y-4 min-h-0",
        "bg-[var(--panel-bg-inset)]",
        messages.length === 0 
          ? "overflow-hidden" 
          : "overflow-y-auto overflow-x-hidden scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/10 hover:scrollbar-thumb-white/20"
      )}>
        {messages.length === 0 ? (
          <div className="relative flex flex-col items-center justify-center h-full text-center py-8">
            {/* Glow effect that follows mouse */}
            <div 
              className="absolute w-40 h-40 rounded-full bg-glow/25 blur-3xl pointer-events-none transition-all duration-300 ease-out"
              style={{ 
                left: `${glowPosition.x}%`, 
                top: `${glowPosition.y}%`,
                transform: 'translate(-50%, -50%)'
              }}
            />
            
            <div 
              className="relative w-12 h-12 rounded-xl bg-[#161619] border border-white/5 flex items-center justify-center mb-4"
              style={{ boxShadow: "inset 0 1px 2px rgba(255, 255, 255, 0.05)" }}
            >
              <OutletIcon className="w-6 h-6 text-[#f0f0f2]" animated />
            </div>
            <p className="relative text-sm text-[#8a8a94] max-w-[280px] leading-relaxed">
              Tell me what you want to build. I&apos;ll create the workflow for you.
            </p>
            <div className="relative mt-4 flex flex-wrap gap-2 justify-center">
              {["Generate logo variations", "Extract color palette", "Create landing page"].map(
                (suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => setInput(suggestion)}
                    className="button-pill text-xs px-4 py-2"
                  >
                    {suggestion}
                  </button>
                )
              )}
            </div>
          </div>
        ) : (
          <div className="max-w-5xl mx-auto w-full space-y-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={cn(
                  "flex gap-3",
                  message.role === "user" ? "flex-row-reverse" : "flex-row"
                )}
              >
              <div
                className={cn(
                  "flex-shrink-0 w-7 h-7 flex items-center justify-center border border-white/5 overflow-hidden",
                  message.role === "user"
                    ? "rounded-full bg-[#C157C1]/10"
                    : "rounded-lg bg-[#161619]"
                )}
              >
                {message.role === "user" ? (
                  userAvatarUrl ? (
                    <img 
                      src={userAvatarUrl} 
                      alt="You" 
                      className="w-full h-full rounded-full object-cover"
                    />
                  ) : (
                    <span className="text-xs font-medium text-[#C157C1]">
                      {user?.email?.[0]?.toUpperCase() || "U"}
                    </span>
                  )
                ) : (
                  <OutletIcon className="w-4 h-4 text-[#f0f0f2]" />
                )}
              </div>
              <div
                className={cn(
                  "flex-1 px-3 py-2 rounded-xl text-sm",
                  message.role === "user"
                    ? "bg-secondary text-secondary-foreground"
                    : "bg-[#161619] text-[#f0f0f2]"
                )}
              >
                {(() => {
                  const text = getMessageText(message)
                  if (text) {
                    return message.role === "assistant" ? (
                      <MarkdownRenderer content={text} />
                    ) : (
                      text
                    )
                  }
                  if (isLoading && message.role === "assistant") {
                    return (
                      <span className="flex items-center gap-2 text-[#8a8a94]">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        Thinking...
                      </span>
                    )
                  }
                  return null
                })()}
              </div>
            </div>
            ))}
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Lightbox */}
      {lightboxFile && (
        <div 
          className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-8"
          onClick={() => setLightboxFile(null)}
        >
          <div className="relative max-w-full max-h-full">
            <button
              onClick={() => setLightboxFile(null)}
              className="absolute -top-10 right-0 p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
              aria-label="Close preview"
            >
              <X className="w-5 h-5" />
            </button>
            {lightboxFile.type === "image" && lightboxFile.preview ? (
              <img
                src={lightboxFile.preview}
                alt={lightboxFile.file.name}
                className="max-w-full max-h-[80vh] rounded-lg object-contain"
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <div 
                className="bg-[#161619] rounded-lg p-8 flex flex-col items-center gap-4"
                onClick={(e) => e.stopPropagation()}
              >
                <FileText className="w-16 h-16 text-[#8a8a94]" />
                <p className="text-[#f0f0f2] text-sm">{lightboxFile.file.name}</p>
                <p className="text-[#8a8a94] text-xs">
                  {(lightboxFile.file.size / 1024).toFixed(1)} KB
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Input */}
      <form onSubmit={handleSubmit} className="p-4 border-t border-white/5">
        {/* File previews - inline pill style */}
        {uploadedFiles.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-2">
            {uploadedFiles.map((file) => (
              <div
                key={file.id}
                className="group flex items-center gap-1.5 h-7 pl-1 pr-1.5 rounded-full bg-[#1a1a1f] border border-white/10"
              >
                {/* Clickable preview */}
                <button
                  type="button"
                  onClick={() => setLightboxFile(file)}
                  className="flex items-center gap-1.5 hover:opacity-80 transition-opacity"
                >
                  {file.type === "image" && file.preview ? (
                    <img
                      src={file.preview}
                      alt={file.file.name}
                      className="w-5 h-5 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-5 h-5 rounded-full bg-[#161619] flex items-center justify-center">
                      <FileText className="w-3 h-3 text-[#8a8a94]" />
                    </div>
                  )}
                  <span className="text-[11px] text-[#8a8a94] max-w-[100px] truncate">
                    {file.file.name}
                  </span>
                </button>
                {/* Remove button */}
                <button
                  type="button"
                  onClick={() => removeFile(file.id)}
                  className="p-0.5 rounded-full hover:bg-white/10 text-[#5a5a64] hover:text-[#f0f0f2] transition-colors"
                  aria-label={`Remove ${file.file.name}`}
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}
        
        {/* Upload error */}
        {uploadError && (
          <p className="text-[11px] text-red-400 mb-2">{uploadError}</p>
        )}

        <div className="relative">
          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept={ALLOWED_EXTENSIONS.join(",")}
            onChange={handleFileChange}
            className="hidden"
          />

          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            placeholder="Describe what you want to build..."
            rows={1}
            className="w-full resize-none border border-white/[0.06] rounded-xl pl-4 pr-4 pt-4 pb-14 text-sm text-[#f0f0f2] placeholder:text-[#8a8a94] focus:outline-none max-h-[160px] transition-colors overflow-y-auto scrollbar-none chat-input-gradient"
            style={{
              height: "70px",
              minHeight: "90px",
            }}
            onInput={(e) => {
              const target = e.target as HTMLTextAreaElement
              target.style.height = "auto"
              target.style.height = Math.min(target.scrollHeight, 160) + "px"
            }}
          />
          
          {/* Bottom toolbar inside input */}
          <div className="absolute bottom-2.5 left-2.5 right-2.5 flex items-center justify-between">
            {/* Attach button */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadedFiles.length >= MAX_FILES}
              className="flex items-center justify-center w-8 h-8 rounded-lg hover:bg-white/5 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              aria-label="Attach files"
            >
              <Paperclip className="w-4 h-4 text-[#8a8a94]" />
            </button>
            
            {/* Submit button */}
            <button
              type="submit"
              disabled={(!input.trim() && uploadedFiles.length === 0) || isLoading}
              className="flex items-center justify-center w-8 h-8 rounded-lg bg-[#f0f0f2] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 text-[#111114] animate-spin" />
              ) : (
                <ArrowUp className="w-4 h-4 text-[#111114]" />
              )}
            </button>
          </div>
        </div>

      </form>
    </div>
  )
}
