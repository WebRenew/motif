"use client"

import { memo, useState, useCallback, useRef, useEffect } from "react"
import { type NodeProps, useReactFlow } from "@xyflow/react"

export type StickyNoteColor = "yellow" | "pink" | "blue" | "green" | "purple" | "orange"

export type StickyNoteNodeData = {
  content: string
  color: StickyNoteColor
  fontSize: "sm" | "md" | "lg"
}

const STICKY_NOTE_COLORS: Record<StickyNoteColor, string> = {
  yellow: "bg-amber-200",
  pink: "bg-pink-200",
  blue: "bg-sky-200",
  green: "bg-emerald-200",
  purple: "bg-violet-200",
  orange: "bg-orange-200",
}

const FONT_SIZES = {
  sm: "text-xs",
  md: "text-sm",
  lg: "text-base",
}

const COLOR_OPTIONS: StickyNoteColor[] = ["yellow", "pink", "blue", "green", "purple", "orange"]

export const StickyNoteNode = memo(function StickyNoteNode({ id, data }: NodeProps) {
  const { content = "", color = "yellow", fontSize = "md" } = data as StickyNoteNodeData
  const { setNodes } = useReactFlow()

  const [isEditing, setIsEditing] = useState(false)
  const [editedContent, setEditedContent] = useState(content)
  const [showColorPicker, setShowColorPicker] = useState(false)
  const [cardWidth, setCardWidth] = useState(200)
  const [cardHeight, setCardHeight] = useState(150)
  const [isResizing, setIsResizing] = useState(false)

  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const cardRef = useRef<HTMLDivElement>(null)
  const startXRef = useRef(0)
  const startYRef = useRef(0)
  const startWidthRef = useRef(0)
  const startHeightRef = useRef(0)

  // Sync local state when data changes externally
  useEffect(() => {
    setEditedContent(content)
  }, [content])

  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    setIsEditing(true)
  }, [])

  const handleSaveContent = useCallback(() => {
    setIsEditing(false)
    setNodes((nodes) =>
      nodes.map((node) =>
        node.id === id ? { ...node, data: { ...node.data, content: editedContent } } : node
      )
    )
  }, [id, editedContent, setNodes])

  const handleColorChange = useCallback(
    (newColor: StickyNoteColor) => {
      setShowColorPicker(false)
      setNodes((nodes) =>
        nodes.map((node) =>
          node.id === id ? { ...node, data: { ...node.data, color: newColor } } : node
        )
      )
    },
    [id, setNodes]
  )

  const handleFontSizeChange = useCallback(
    (newSize: "sm" | "md" | "lg") => {
      setNodes((nodes) =>
        nodes.map((node) =>
          node.id === id ? { ...node, data: { ...node.data, fontSize: newSize } } : node
        )
      )
    },
    [id, setNodes]
  )

  // Focus textarea when entering edit mode
  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus()
      textareaRef.current.select()
    }
  }, [isEditing])

  // Close color picker on outside click
  useEffect(() => {
    if (showColorPicker) {
      const handleClickOutside = (e: MouseEvent) => {
        const target = e.target as Node
        if (!cardRef.current?.contains(target)) {
          setShowColorPicker(false)
        }
      }
      document.addEventListener("mousedown", handleClickOutside)
      return () => document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [showColorPicker])

  // Resize handlers
  const handleResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setIsResizing(true)
      startXRef.current = e.clientX
      startYRef.current = e.clientY
      startWidthRef.current = cardWidth
      startHeightRef.current = cardHeight
    },
    [cardWidth, cardHeight]
  )

  useEffect(() => {
    if (!isResizing) return

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - startXRef.current
      const deltaY = e.clientY - startYRef.current
      const newWidth = Math.max(150, Math.min(400, startWidthRef.current + deltaX))
      const newHeight = Math.max(100, Math.min(500, startHeightRef.current + deltaY))
      setCardWidth(newWidth)
      setCardHeight(newHeight)
    }

    const handleMouseUp = () => {
      setIsResizing(false)
    }

    document.addEventListener("mousemove", handleMouseMove)
    document.addEventListener("mouseup", handleMouseUp)
    return () => {
      document.removeEventListener("mousemove", handleMouseMove)
      document.removeEventListener("mouseup", handleMouseUp)
    }
  }, [isResizing])

  const bgColorClass = STICKY_NOTE_COLORS[color] || STICKY_NOTE_COLORS.yellow
  const fontSizeClass = FONT_SIZES[fontSize] || FONT_SIZES.md

  return (
    <div
      ref={cardRef}
      style={{ width: cardWidth, height: cardHeight }}
      className={`${bgColorClass} shadow-md p-3 relative flex flex-col transition-shadow`}
      onDoubleClick={handleDoubleClick}
    >
      {/* Header with color picker toggle */}
      <div className="flex items-center justify-between mb-2 gap-1">
        {/* Color picker */}
        <div className="relative">
          <button
            onClick={(e) => {
              e.stopPropagation()
              setShowColorPicker(!showColorPicker)
            }}
            className="w-4 h-4 rounded-full border border-gray-400/50 hover:scale-110 transition-transform"
            style={{
              backgroundColor:
                color === "yellow"
                  ? "#fcd34d"
                  : color === "pink"
                    ? "#f9a8d4"
                    : color === "blue"
                      ? "#7dd3fc"
                      : color === "green"
                        ? "#6ee7b7"
                        : color === "purple"
                          ? "#c4b5fd"
                          : "#fdba74",
            }}
            title="Change color"
          />
          {showColorPicker && (
            <div className="absolute top-6 left-0 bg-white rounded-lg shadow-lg p-2 flex gap-1.5 z-10">
              {COLOR_OPTIONS.map((c) => (
                <button
                  key={c}
                  onClick={(e) => {
                    e.stopPropagation()
                    handleColorChange(c)
                  }}
                  className={`w-5 h-5 rounded-full border-2 transition-transform hover:scale-110 ${
                    c === color ? "border-gray-600" : "border-transparent"
                  }`}
                  style={{
                    backgroundColor:
                      c === "yellow"
                        ? "#fcd34d"
                        : c === "pink"
                          ? "#f9a8d4"
                          : c === "blue"
                            ? "#7dd3fc"
                            : c === "green"
                              ? "#6ee7b7"
                              : c === "purple"
                                ? "#c4b5fd"
                                : "#fdba74",
                  }}
                  title={c}
                />
              ))}
            </div>
          )}
        </div>

        {/* Font size controls */}
        <div className="flex items-center gap-0.5">
          {(["sm", "md", "lg"] as const).map((size) => (
            <button
              key={size}
              onClick={(e) => {
                e.stopPropagation()
                handleFontSizeChange(size)
              }}
              className={`px-1.5 py-0.5 rounded text-gray-600 hover:bg-gray-800/10 transition-colors ${
                fontSize === size ? "bg-gray-800/20 font-medium" : ""
              }`}
              style={{ fontSize: size === "sm" ? "10px" : size === "md" ? "12px" : "14px" }}
              title={`${size === "sm" ? "Small" : size === "md" ? "Medium" : "Large"} text`}
            >
              A
            </button>
          ))}
        </div>
      </div>

      {/* Content area */}
      <div className="flex-1 overflow-hidden">
        {isEditing ? (
          <textarea
            ref={textareaRef}
            value={editedContent}
            onChange={(e) => setEditedContent(e.target.value)}
            onBlur={handleSaveContent}
            onKeyDown={(e) => {
              if (e.key === "Escape") handleSaveContent()
            }}
            className={`w-full h-full bg-transparent text-gray-800 resize-none outline-none ${fontSizeClass} placeholder:text-gray-500`}
            placeholder="Add a note..."
          />
        ) : (
          <p
            className={`text-gray-800 whitespace-pre-wrap break-words h-full overflow-auto ${fontSizeClass} ${
              !content ? "text-gray-500 italic" : ""
            }`}
          >
            {content || "Double-click to edit..."}
          </p>
        )}
      </div>

      {/* Resize handle */}
      <div
        onMouseDown={handleResizeStart}
        className="absolute bottom-0 right-0 w-4 h-4 cursor-nwse-resize hover:bg-gray-800/10 transition-colors"
      />
    </div>
  )
})
