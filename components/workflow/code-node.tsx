"use client"

import type React from "react"

import { memo, useCallback, useState, useRef, useEffect } from "react"
import { Handle, Position, type NodeProps } from "@xyflow/react"
import { FileCode2, Download, Copy, Check, ChevronDown } from "lucide-react"
import { createPortal } from "react-dom"

const LANGUAGE_OPTIONS = [
  { value: "tsx", label: "TSX", description: "React TypeScript" },
  { value: "jsx", label: "JSX", description: "React JavaScript" },
  { value: "css", label: "CSS", description: "Stylesheets" },
  { value: "json", label: "JSON", description: "Data/Config" },
  { value: "ts", label: "TypeScript", description: "Node/Scripts" },
  { value: "js", label: "JavaScript", description: "Node/Scripts" },
  { value: "mdx", label: "MDX", description: "Markdown + JSX" },
]

interface CodeNodeData {
  content?: string
  language?: string
  isGenerating?: boolean
  label?: string
  onLanguageChange?: (language: string) => void
}

const highlightCode = (code: string, language: string): React.ReactNode => {
  // Simple syntax highlighting patterns
  const patterns: Record<string, RegExp> = {
    keywords:
      /\b(const|let|var|function|return|if|else|for|while|import|export|from|default|class|extends|interface|type|async|await|try|catch|throw|new|this|true|false|null|undefined)\b/g,
    strings: /(["'`])(?:(?!\1)[^\\]|\\.)*?\1/g,
    comments: /(\/\/.*$|\/\*[\s\S]*?\*\/)/gm,
    numbers: /\b(\d+\.?\d*)\b/g,
    properties: /(\.[a-zA-Z_][a-zA-Z0-9_]*)/g,
    tags: /<\/?([a-zA-Z][a-zA-Z0-9]*)/g,
    attributes: /\s([a-zA-Z-]+)=/g,
    cssProperties: /([a-z-]+)(?=\s*:)/g,
    cssValues: /:\s*([^;{}]+)/g,
  }

  // Tokenize and highlight
  const tokens: { start: number; end: number; type: string; text: string }[] = []

  // Collect all matches
  const collectMatches = (regex: RegExp, type: string) => {
    let match
    const r = new RegExp(regex.source, regex.flags)
    while ((match = r.exec(code)) !== null) {
      tokens.push({
        start: match.index,
        end: match.index + match[0].length,
        type,
        text: match[0],
      })
    }
  }

  if (language === "css") {
    collectMatches(patterns.comments, "comment")
    collectMatches(patterns.cssProperties, "property")
    collectMatches(patterns.numbers, "number")
    collectMatches(patterns.strings, "string")
  } else {
    collectMatches(patterns.comments, "comment")
    collectMatches(patterns.strings, "string")
    collectMatches(patterns.keywords, "keyword")
    collectMatches(patterns.numbers, "number")
    collectMatches(patterns.tags, "tag")
  }

  // Sort by position and filter overlaps
  tokens.sort((a, b) => a.start - b.start)
  const filteredTokens: typeof tokens = []
  let lastEnd = 0
  for (const token of tokens) {
    if (token.start >= lastEnd) {
      filteredTokens.push(token)
      lastEnd = token.end
    }
  }

  // Build highlighted output
  const parts: React.ReactNode[] = []
  let currentIndex = 0

  filteredTokens.forEach((token, i) => {
    // Add plain text before token
    if (token.start > currentIndex) {
      parts.push(<span key={`plain-${i}`}>{code.slice(currentIndex, token.start)}</span>)
    }

    const colorMap: Record<string, string> = {
      keyword: "text-violet-700",
      string: "text-rose-600",
      comment: "text-neutral-500 italic",
      number: "text-teal-600",
      property: "text-cyan-700",
      tag: "text-fuchsia-700",
    }

    parts.push(
      <span key={`token-${i}`} className={colorMap[token.type] || ""}>
        {token.text}
      </span>,
    )
    currentIndex = token.end
  })

  // Add remaining text
  if (currentIndex < code.length) {
    parts.push(<span key="final">{code.slice(currentIndex)}</span>)
  }

  return parts.length > 0 ? parts : code
}

export const CodeNode = memo(function CodeNode({ data, selected }: NodeProps) {
  const { content, language = "css", isGenerating, label } = data as CodeNodeData
  const [copied, setCopied] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)
  const [localLanguage, setLocalLanguage] = useState(language)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0 })

  const displayLabel = label || LANGUAGE_OPTIONS.find((l) => l.value === localLanguage)?.label || "Code Output"

  useEffect(() => {
    if (showDropdown && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect()
      setDropdownPos({ top: rect.bottom + 4, left: rect.left })
    }
  }, [showDropdown])

  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!showDropdown) return
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as globalThis.Node
      // Don't close if clicking on the dropdown button or inside the dropdown portal
      if (buttonRef.current?.contains(target) || dropdownRef.current?.contains(target)) {
        return
      }
      setShowDropdown(false)
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [showDropdown])

  const handleLanguageSelect = useCallback(
    (lang: string) => {
      setLocalLanguage(lang)
      setShowDropdown(false)
      // Notify parent if callback provided
      if ((data as CodeNodeData).onLanguageChange) {
        ;(data as CodeNodeData).onLanguageChange!(lang)
      }
    },
    [data],
  )

  const handleDownload = useCallback(() => {
    if (!content) return

    const extensionMap: Record<string, string> = {
      tsx: "tsx",
      jsx: "jsx",
      css: "css",
      mdx: "mdx",
      markdown: "md",
      json: "json",
      ts: "ts",
      js: "js",
    }
    const extension = extensionMap[localLanguage] || "txt"
    const mimeType = localLanguage === "css" ? "text/css" : "text/plain"
    const blob = new Blob([content], { type: mimeType })
    const url = URL.createObjectURL(blob)

    const link = document.createElement("a")
    link.href = url
    const safeLabel = displayLabel.toLowerCase().replace(/\s+/g, "-")
    link.download = `motif-${safeLabel}-${Date.now()}.${extension}`
    link.click()

    URL.revokeObjectURL(url)
  }, [content, localLanguage, displayLabel])

  const handleCopy = useCallback(() => {
    if (!content) return

    navigator.clipboard.writeText(content).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }, [content])

  const _currentLangOption = LANGUAGE_OPTIONS.find((l) => l.value === localLanguage)

  return (
    <div
      className={`
        relative bg-card rounded-2xl shadow-md border-2 transition-all duration-200
        ${selected ? "border-node-selected shadow-lg" : "border-border"}
        ${isGenerating ? "animate-pulse" : ""}
      `}
      style={{ width: 380, minHeight: 200 }}
    >
      <Handle type="target" position={Position.Left} className="!w-3 !h-3 !bg-node-handle !border-2 !border-card" />

      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
        <FileCode2 className="w-4 h-4 text-node-selected" />
        <span className="text-sm font-medium text-card-foreground">{displayLabel}</span>

        <button
          ref={buttonRef}
          onClick={() => setShowDropdown(!showDropdown)}
          className="ml-auto flex items-center gap-1 px-2 py-1 rounded-md text-xs font-mono uppercase text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
        >
          {localLanguage}
          <ChevronDown className="w-3 h-3" />
        </button>

        {content && (
          <div className="flex items-center gap-1">
            <button
              onClick={handleCopy}
              className="p-1.5 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
              title="Copy to clipboard"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-success" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
            <button
              onClick={handleDownload}
              className="p-1.5 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
              title="Download file"
            >
              <Download className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Language Dropdown Portal */}
      {showDropdown &&
        typeof window !== "undefined" &&
        createPortal(
          <div
            ref={dropdownRef}
            className="fixed z-50 bg-card border border-border rounded-lg shadow-lg py-1 min-w-[160px]"
            style={{ top: dropdownPos.top, left: dropdownPos.left }}
          >
            {LANGUAGE_OPTIONS.map((option) => (
              <button
                key={option.value}
                onClick={() => handleLanguageSelect(option.value)}
                className={`w-full px-3 py-2 text-left hover:bg-accent transition-colors flex items-center justify-between ${
                  localLanguage === option.value ? "bg-accent/50" : ""
                }`}
              >
                <div>
                  <span className="text-sm font-medium text-foreground">{option.label}</span>
                  <span className="text-xs text-muted-foreground ml-2">{option.description}</span>
                </div>
                {localLanguage === option.value && <Check className="w-4 h-4 text-node-selected" />}
              </button>
            ))}
          </div>,
          document.body,
        )}

      {/* Code Content */}
      <div className="p-3 max-h-[300px] overflow-auto bg-neutral-100 rounded-b-xl">
        {isGenerating ? (
          <div className="flex items-center justify-center h-32 text-neutral-500">
            <div className="flex flex-col items-center gap-2">
              <div className="w-6 h-6 border-2 border-node-selected border-t-transparent rounded-full animate-spin" />
              <span className="text-xs">Generating {displayLabel.toLowerCase()}...</span>
            </div>
          </div>
        ) : content ? (
          <pre className="text-xs font-mono text-neutral-800 whitespace-pre-wrap leading-relaxed">
            <code>{highlightCode(content, localLanguage)}</code>
          </pre>
        ) : (
          <div className="flex items-center justify-center h-32 text-neutral-400">
            <span className="text-sm">Output will appear here</span>
          </div>
        )}
      </div>

      {/* Source handle - allows code to be used as input to other nodes */}
      {content && (
        <Handle
          type="source"
          position={Position.Right}
          className="!w-3 !h-3 !bg-node-selected !border-2 !border-card"
        />
      )}
    </div>
  )
})
