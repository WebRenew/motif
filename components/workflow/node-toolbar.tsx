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
 * - INPUTS section: Image, Code, Text, Note, Capture (things you bring in)
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
import { ImageIcon, MessageSquare, Trash2, FileCode2, Type, StickyNote, Video, ChevronRight, Sparkles } from "lucide-react"

// Workflow/nodes icon for collapsed state
const WorkflowIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true" focusable="false">
    <path d="M160,112h48a16,16,0,0,0,16-16V48a16,16,0,0,0-16-16H160a16,16,0,0,0-16,16V64H128a24,24,0,0,0-24,24v32H72v-8A16,16,0,0,0,56,96H24A16,16,0,0,0,8,112v32a16,16,0,0,0,16,16H56a16,16,0,0,0,16-16v-8h32v32a24,24,0,0,0,24,24h16v16a16,16,0,0,0,16,16h48a16,16,0,0,0,16-16V160a16,16,0,0,0-16-16H160a16,16,0,0,0-16,16v16H128a8,8,0,0,1-8-8V88a8,8,0,0,1,8-8h16V96A16,16,0,0,0,160,112ZM56,144H24V112H56v32Zm104,16h48v48H160Zm0-112h48V96H160Z"/>
  </svg>
)

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
  onAddStickyNoteNode,
  onAddCaptureNode,
  onDeleteSelected,
  hasSelection,
}: NodeToolbarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false)

  return (
    <>
      {/* Toolbar - responsive: icon-only on mobile, full labels on desktop */}
      <div className="absolute bottom-4 right-4 z-10">
        <div className="flex items-center bg-card border border-border rounded-lg shadow-sm">
          {/* Collapse/Expand toggle */}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-2 hover:bg-muted transition-colors rounded-l-lg border-r border-border text-muted-foreground"
            title={isCollapsed ? "Expand toolbar" : "Collapse toolbar"}
          >
            {isCollapsed ? (
              <WorkflowIcon />
            ) : (
              <ChevronRight className="w-4 h-4" />
            )}
          </button>

          {!isCollapsed && (
            <>
              <div className="flex items-center gap-0.5 px-1.5 py-1 border-r border-border">
                <span className="hidden sm:inline text-[10px] font-mono text-muted-foreground/60 uppercase tracking-wider px-1">Inputs</span>
                <button
                  onClick={onAddImageNode}
                  className="p-2 rounded-md hover:bg-muted active:bg-muted/80 transition-colors text-muted-foreground"
                  title="Add Image (Input or Output)"
                >
                  <ImageIcon className="w-4 h-4" />
                </button>
                <button
                  onClick={onAddCodeNode}
                  className="p-2 rounded-md hover:bg-muted active:bg-muted/80 transition-colors text-muted-foreground"
                  title="Add Code Block"
                >
                  <FileCode2 className="w-4 h-4" />
                </button>
                {onAddTextInputNode && (
                  <button
                    onClick={onAddTextInputNode}
                    className="p-2 rounded-md hover:bg-muted active:bg-muted/80 transition-colors text-muted-foreground"
                    title="Add Text Input"
                  >
                    <Type className="w-4 h-4 text-blue-500" />
                  </button>
                )}
                {onAddStickyNoteNode && (
                  <button
                    onClick={onAddStickyNoteNode}
                    className="p-2 rounded-md hover:bg-muted active:bg-muted/80 transition-colors text-muted-foreground"
                    title="Add Sticky Note"
                  >
                    <StickyNote className="w-4 h-4 text-amber-500" />
                  </button>
                )}
                {onAddCaptureNode && (
                  <button
                    onClick={onAddCaptureNode}
                    className="p-2 rounded-md hover:bg-muted active:bg-muted/80 transition-colors text-muted-foreground"
                    title="Add Animation Capture"
                  >
                    <Video className="w-4 h-4 text-red-500" />
                  </button>
                )}
              </div>

              <div className="flex items-center gap-0.5 px-1.5 py-1">
                <span className="hidden sm:inline text-[10px] font-mono text-muted-foreground/60 uppercase tracking-wider px-1">Agents</span>
                <button
                  onClick={() => onAddPromptNode("image")}
                  className="relative p-2 rounded-md hover:bg-muted active:bg-muted/80 transition-colors text-muted-foreground"
                  title="Image Generation Prompt"
                >
                  <ImageIcon className="w-4 h-4" />
                  <Sparkles className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 text-muted-foreground/60" />
                </button>
                <button
                  onClick={() => onAddPromptNode("text")}
                  className="relative p-2 rounded-md hover:bg-muted active:bg-muted/80 transition-colors text-muted-foreground"
                  title="Text Generation Prompt"
                >
                  <MessageSquare className="w-4 h-4" />
                  <Sparkles className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 text-muted-foreground/60" />
                </button>
              </div>

              {hasSelection && (
                <div className="border-l border-border">
                  <button
                    onClick={onDeleteSelected}
                    className="p-2 rounded-r-lg hover:bg-destructive/10 active:bg-destructive/20 text-destructive transition-colors"
                    title="Delete Selected (Del)"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
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
