"use client"

/**
 * Node Toolbar Component
 *
 * LAYOUT REFERENCE (verified correct):
 * - IO Toolbar: bottom-4 right-4 (1rem from edges)
 * - Hints: bottom-4 left-1/2 centered
 * - Zoom Controls (ReactFlow): left-1rem bottom-1rem (set via CSS in globals.css)
 *
 * TOOLBAR STRUCTURE:
 * - INPUTS section: Image, Code, Text, Capture (things you bring in)
 * - Vertical divider
 * - AGENTS section: Img Gen, Text Gen (AI generators)
 * - Conditional delete button when selection exists
 *
 * SPACING:
 * - Container: px-1, rounded-lg (matches left zoom controls)
 * - Buttons: p-2, gap-0.5 between buttons
 * - Section labels: text-[10px] font-mono uppercase tracking-wider
 */

import { memo, useState } from "react"
import { ImageIcon, MessageSquare, Trash2, FileCode2, Type, Video, ChevronRight, Sparkles } from "lucide-react"

// Workflow/nodes icon for collapsed state
const WorkflowIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true" focusable="false">
    <path d="M160,112h48a16,16,0,0,0,16-16V48a16,16,0,0,0-16-16H160a16,16,0,0,0-16,16V64H128a24,24,0,0,0-24,24v32H72v-8A16,16,0,0,0,56,96H24A16,16,0,0,0,8,112v32a16,16,0,0,0,16,16H56a16,16,0,0,0,16-16v-8h32v32a24,24,0,0,0,24,24h16v16a16,16,0,0,0,16,16h48a16,16,0,0,0,16-16V160a16,16,0,0,0-16-16H160a16,16,0,0,0-16,16v16H128a8,8,0,0,1-8-8V88a8,8,0,0,1,8-8h16V96A16,16,0,0,0,160,112ZM56,144H24V112H56v32Zm104,16h48v48H160Zm0-112h48V96H160Z"/>
  </svg>
)

// Tooltip component
function Tooltip({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <div className="relative group/tooltip">
      {children}
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 text-xs font-medium text-foreground bg-popover border border-border rounded-md shadow-md opacity-0 group-hover/tooltip:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
        {label}
        <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px border-4 border-transparent border-t-border" />
        <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-popover" />
      </div>
    </div>
  )
}

type NodeToolbarProps = {
  onAddImageNode: () => void
  onAddPromptNode: (outputType: "image" | "text") => void
  onAddCodeNode: () => void
  onAddTextInputNode?: () => void
  onAddStickyNoteNode?: () => void
  onAddCaptureNode?: () => void
  onDeleteSelected: () => void
  hasSelection: boolean
}

export const NodeToolbar = memo(function NodeToolbar({
  onAddImageNode,
  onAddPromptNode,
  onAddCodeNode,
  onAddTextInputNode,
  onAddCaptureNode,
  onDeleteSelected,
  hasSelection,
}: NodeToolbarProps) {
  const [isCollapsed, setIsCollapsed] = useState(true)

  return (
    <>
      {/* Toolbar - responsive: icon-only on mobile, full labels on desktop */}
      <div className="absolute bottom-4 right-4 z-10">
        <div className="flex items-center bg-card border border-border rounded-lg shadow-sm">
          {/* Collapse/Expand toggle */}
          <Tooltip label={isCollapsed ? "Expand toolbar" : "Collapse toolbar"}>
            <button
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="p-2 hover:bg-muted transition-colors rounded-l-lg border-r border-border text-muted-foreground"
            >
              {isCollapsed ? (
                <WorkflowIcon />
              ) : (
                <ChevronRight className="w-4 h-4" />
              )}
            </button>
          </Tooltip>

          {!isCollapsed && (
            <>
              <div className="flex items-center gap-0.5 px-1.5 py-1 border-r border-border">
                <span className="hidden sm:inline text-[10px] font-mono text-muted-foreground/60 uppercase tracking-wider px-1">Inputs</span>
                <Tooltip label="Add Image">
                  <button
                    onClick={onAddImageNode}
                    className="p-2 rounded-md hover:bg-blue-500/10 active:bg-blue-500/20 transition-colors text-muted-foreground hover:text-blue-500"
                  >
                    <ImageIcon className="w-4 h-4" />
                  </button>
                </Tooltip>
                <Tooltip label="Add Code Block">
                  <button
                    onClick={onAddCodeNode}
                    className="p-2 rounded-md hover:bg-emerald-500/10 active:bg-emerald-500/20 transition-colors text-muted-foreground hover:text-emerald-500"
                  >
                    <FileCode2 className="w-4 h-4" />
                  </button>
                </Tooltip>
                {onAddTextInputNode && (
                  <Tooltip label="Add Text Input">
                    <button
                      onClick={onAddTextInputNode}
                      className="p-2 rounded-md hover:bg-sky-500/10 active:bg-sky-500/20 transition-colors text-muted-foreground hover:text-sky-500"
                    >
                      <Type className="w-4 h-4" />
                    </button>
                  </Tooltip>
                )}
                {onAddCaptureNode && (
                  <Tooltip label="Add Animation Capture">
                    <button
                      onClick={onAddCaptureNode}
                      className="p-2 rounded-md hover:bg-red-500/10 active:bg-red-500/20 transition-colors text-muted-foreground hover:text-red-500"
                    >
                      <Video className="w-4 h-4" />
                    </button>
                  </Tooltip>
                )}
              </div>

              <div className="flex items-center gap-0.5 px-1.5 py-1">
                <span className="hidden sm:inline text-[10px] font-mono text-muted-foreground/60 uppercase tracking-wider px-1">Agents</span>
                <Tooltip label="Image Generation">
                  <button
                    onClick={() => onAddPromptNode("image")}
                    className="relative p-2 rounded-md hover:bg-violet-500/10 active:bg-violet-500/20 transition-colors text-muted-foreground hover:text-violet-500"
                  >
                    <ImageIcon className="w-4 h-4" />
                    <Sparkles className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 opacity-60" />
                  </button>
                </Tooltip>
                <Tooltip label="Text Generation">
                  <button
                    onClick={() => onAddPromptNode("text")}
                    className="relative p-2 rounded-md hover:bg-amber-500/10 active:bg-amber-500/20 transition-colors text-muted-foreground hover:text-amber-500"
                  >
                    <MessageSquare className="w-4 h-4" />
                    <Sparkles className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 opacity-60" />
                  </button>
                </Tooltip>
              </div>

              {hasSelection && (
                <div className="border-l border-border">
                  <Tooltip label="Delete Selected (Del)">
                    <button
                      onClick={onDeleteSelected}
                      className="p-2 rounded-r-lg hover:bg-destructive/10 active:bg-destructive/20 text-destructive transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </Tooltip>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Hints - hide on mobile, show touch hints on small screens */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-0 hidden sm:block">
        <div className="flex items-center gap-3 text-[10px] text-muted-foreground/50 font-mono tracking-wide">
          <span>Scroll to zoom</span>
          <span className="text-muted-foreground/30">·</span>
          <span>Drag to pan</span>
          <span className="text-muted-foreground/30">·</span>
          <span>Shift+Drag to select</span>
          <span className="text-muted-foreground/30">·</span>
          <span>Right-click to add</span>
        </div>
      </div>

      {/* Mobile touch hints - positioned left to avoid overlap with actions menu */}
      <div className="absolute bottom-4 left-16 z-0 sm:hidden">
        <div className="flex items-center gap-2 text-[9px] text-muted-foreground/50 font-mono tracking-wide">
          <span>Pinch to zoom</span>
          <span className="text-muted-foreground/30">·</span>
          <span>Swipe to pan</span>
        </div>
      </div>
    </>
  )
})
