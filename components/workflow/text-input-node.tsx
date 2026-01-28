"use client"

import { memo, useCallback, useState, useRef, useEffect } from "react"
import { Handle, Position, type NodeProps } from "@xyflow/react"
import { Type, AlertCircle } from "lucide-react"
import { useVisualSettings } from "@/lib/hooks/use-visual-settings"

interface TextInputNodeData {
  value?: string
  label?: string
  placeholder?: string
  inputType?: "text" | "url" | "css-selector" | "number"
  required?: boolean
  onValueChange?: (nodeId: string, value: string) => void
}

/**
 * Validates input based on type
 */
function validateInput(value: string, inputType?: string, required?: boolean): string | null {
  // Required check
  if (required && (!value || value.trim().length === 0)) {
    return "This field is required"
  }

  // Skip other validations if empty and not required
  if (!value || value.trim().length === 0) {
    return null
  }

  // URL validation
  if (inputType === "url") {
    try {
      const url = new URL(value)
      if (url.protocol !== "http:" && url.protocol !== "https:") {
        return "URL must start with http:// or https://"
      }
    } catch {
      return "Invalid URL format"
    }
  }

  // CSS selector validation (basic check)
  if (inputType === "css-selector") {
    // Check for common invalid patterns
    if (value.includes("  ") || value.startsWith(" ") || value.endsWith(" ")) {
      return "CSS selector has extra whitespace"
    }
    // Try to validate using querySelector if available
    if (typeof document !== "undefined") {
      try {
        document.querySelector(value)
      } catch {
        return "Invalid CSS selector syntax"
      }
    }
  }

  // Number validation
  if (inputType === "number") {
    const num = Number(value)
    if (Number.isNaN(num)) {
      return "Must be a valid number"
    }
  }

  return null
}

/**
 * Get display badge text for input type
 */
function getInputTypeBadge(inputType?: string): string {
  switch (inputType) {
    case "url":
      return "URL"
    case "css-selector":
      return "Selector"
    case "number":
      return "Number"
    default:
      return "Text"
  }
}

export const TextInputNode = memo(function TextInputNode({ id, data, selected }: NodeProps) {
  const { value = "", label = "Text Input", placeholder, inputType, required, onValueChange } = data as TextInputNodeData

  const [isEditing, setIsEditing] = useState(false)
  const [localValue, setLocalValue] = useState(value)
  const [validationError, setValidationError] = useState<string | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const { settings } = useVisualSettings()
  
  // Brightness-adaptive styling
  const brightness = settings.backgroundBrightness
  const isLightMode = brightness > 50
  const bgOpacity = brightness / 100

  // Sync local value when prop changes
  useEffect(() => {
    setLocalValue(value)
  }, [value])

  // Focus textarea when editing starts
  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus()
      textareaRef.current.select()
    }
  }, [isEditing])

  // Validate on value change
  useEffect(() => {
    const error = validateInput(localValue, inputType, required)
    setValidationError(error)
  }, [localValue, inputType, required])

  const handleDoubleClick = useCallback(() => {
    setIsEditing(true)
  }, [])

  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setLocalValue(e.target.value)
  }, [])

  const handleSave = useCallback(() => {
    setIsEditing(false)
    if (onValueChange && localValue !== value) {
      onValueChange(id, localValue)
    }
  }, [id, localValue, value, onValueChange])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSave()
    }
    if (e.key === "Escape") {
      setLocalValue(value) // Revert
      setIsEditing(false)
    }
  }, [handleSave, value])

  const handleBlur = useCallback(() => {
    handleSave()
  }, [handleSave])

  const hasValue = localValue && localValue.trim().length > 0
  const hasError = validationError !== null

  return (
    <div
      className={`
        relative rounded-2xl shadow-md border-2 transition-all duration-200
        ${selected ? "border-blue-500 shadow-lg" : hasError ? "border-destructive/50" : ""}
      `}
      style={{ 
        width: 320, 
        minHeight: 100,
        backgroundColor: `rgba(255, 255, 255, ${bgOpacity})`,
        borderColor: selected ? '#3b82f6' : hasError ? 'var(--destructive)' : (isLightMode ? 'rgba(0, 0, 0, 0.1)' : 'var(--border)'),
      }}
      onDoubleClick={handleDoubleClick}
    >
      {/* Target handle - receives connections */}
      <Handle
        type="target"
        position={Position.Left}
        className="!w-3 !h-3 !bg-blue-500 !border-2"
        style={{ borderColor: isLightMode ? 'rgba(255, 255, 255, 0.9)' : 'var(--card)' }}
      />

      {/* Header with blue accent */}
      <div 
        className="flex items-center gap-2 px-4 py-3 border-b"
        style={{ borderColor: isLightMode ? 'rgba(0, 0, 0, 0.1)' : 'var(--border)' }}
      >
        {/* Blue left accent indicator */}
        <div className="absolute left-0 top-3 bottom-3 w-1 bg-blue-500 rounded-r" />

        <Type className="w-4 h-4 text-blue-500" />
        <span 
          className="text-sm font-medium"
          style={{ color: isLightMode ? 'rgba(0, 0, 0, 0.9)' : 'var(--card-foreground)' }}
        >{label}</span>

        {/* Input type badge */}
        <span className="ml-auto px-2 py-0.5 text-[10px] font-mono uppercase tracking-wide text-blue-600 bg-blue-100 rounded">
          {getInputTypeBadge(inputType)}
        </span>

        {/* Required badge */}
        {required && (
          <span className="px-2 py-0.5 text-[10px] font-medium text-amber-700 bg-amber-100 rounded">
            Required
          </span>
        )}
      </div>

      {/* Input area */}
      <div className="p-3">
        {isEditing ? (
          <textarea
            ref={textareaRef}
            value={localValue}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            onBlur={handleBlur}
            placeholder={placeholder}
            className={`
              w-full min-h-[60px] p-2 text-sm font-mono rounded-lg
              border-2 focus:outline-none resize-none
              ${hasError ? "border-destructive focus:border-destructive" : "border-transparent focus:border-blue-500"}
            `}
            style={{ 
              backgroundColor: isLightMode ? 'rgba(0, 0, 0, 0.03)' : 'var(--muted)',
              color: isLightMode ? 'rgba(0, 0, 0, 0.8)' : 'var(--foreground)',
            }}
            rows={2}
          />
        ) : (
          <div
            className="w-full min-h-[60px] p-2 text-sm font-mono rounded-lg cursor-text"
            style={{ 
              backgroundColor: isLightMode ? 'rgba(0, 0, 0, 0.03)' : 'var(--muted)',
              color: hasValue 
                ? (isLightMode ? 'rgba(0, 0, 0, 0.8)' : 'var(--foreground)') 
                : (isLightMode ? 'rgba(0, 0, 0, 0.4)' : 'var(--muted-foreground)'),
            }}
          >
            {hasValue ? localValue : placeholder || "Click to enter value..."}
          </div>
        )}

        {/* Validation error display */}
        {hasError && !isEditing && (
          <div className="flex items-center gap-1 mt-2 text-xs text-destructive">
            <AlertCircle className="w-3 h-3" />
            <span>{validationError}</span>
          </div>
        )}
      </div>

      {/* Source handle - ALWAYS visible (key difference from codeNode) */}
      {/* Color indicates state: blue = has value, gray = empty/blocked */}
      <Handle
        type="source"
        position={Position.Right}
        className={`!w-3 !h-3 !border-2 ${
          hasValue ? "!bg-blue-500" : "!bg-muted-foreground/40"
        }`}
        style={{ borderColor: isLightMode ? 'rgba(255, 255, 255, 0.9)' : 'var(--card)' }}
        title={hasValue ? "Ready to connect" : "Enter a value first"}
      />
    </div>
  )
})
