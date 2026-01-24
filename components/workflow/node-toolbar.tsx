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
 * - DATA section: Image, Code buttons (can be input or output)
 * - Vertical divider (w-px h-5 bg-border mx-2)
 * - ACTIONS section: Img Gen, Text Gen buttons
 * - Conditional delete button when selection exists
 *
 * SPACING:
 * - Container: px-3 py-2, rounded-2xl
 * - Buttons: px-2.5 py-1.5, gap-1.5 between icon and text
 * - Section labels: text-[10px] font-mono uppercase tracking-wider mr-1
 */

import { memo, useState } from "react"
import { ImageIcon, MessageSquare, Trash2, FileCode2, Type, StickyNote, Video, ChevronLeft, ChevronRight } from "lucide-react"

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
        <div className="flex items-center gap-1 bg-card/90 backdrop-blur-sm rounded-2xl px-2 sm:px-3 py-2 shadow-md border border-border transition-all duration-200">
          {/* Collapse/Expand toggle */}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="flex items-center justify-center p-1.5 rounded-lg hover:bg-muted active:bg-muted/80 transition-colors text-muted-foreground"
            title={isCollapsed ? "Expand toolbar" : "Collapse toolbar"}
          >
            {isCollapsed ? (
              <ChevronLeft className="w-4 h-4" />
            ) : (
              <ChevronRight className="w-4 h-4" />
            )}
          </button>

          {!isCollapsed && (
            <>
              <div className="w-px h-5 bg-border mx-1" />

              <div className="flex items-center gap-1">
                <span className="hidden sm:inline text-[10px] font-mono text-muted-foreground/60 uppercase tracking-wider mr-1">Data</span>
                <button
                  onClick={onAddImageNode}
                  className="flex items-center gap-1.5 p-2 sm:px-2.5 sm:py-1.5 rounded-lg hover:bg-muted active:bg-muted/80 transition-colors text-muted-foreground"
                  title="Add Image (Input or Output)"
                >
                  <ImageIcon className="w-4 h-4" />
                  <span className="hidden sm:inline text-xs font-medium">Image</span>
                </button>
                <button
                  onClick={onAddCodeNode}
                  className="flex items-center gap-1.5 p-2 sm:px-2.5 sm:py-1.5 rounded-lg hover:bg-muted active:bg-muted/80 transition-colors text-muted-foreground"
                  title="Add Code Block"
                >
                  <FileCode2 className="w-4 h-4" />
                  <span className="hidden sm:inline text-xs font-medium">Code</span>
                </button>
                {onAddTextInputNode && (
                  <button
                    onClick={onAddTextInputNode}
                    className="flex items-center gap-1.5 p-2 sm:px-2.5 sm:py-1.5 rounded-lg hover:bg-muted active:bg-muted/80 transition-colors text-muted-foreground"
                    title="Add Text Input"
                  >
                    <Type className="w-4 h-4 text-blue-500" />
                    <span className="hidden sm:inline text-xs font-medium">Text</span>
                  </button>
                )}
                {onAddStickyNoteNode && (
                  <button
                    onClick={onAddStickyNoteNode}
                    className="flex items-center gap-1.5 p-2 sm:px-2.5 sm:py-1.5 rounded-lg hover:bg-muted active:bg-muted/80 transition-colors text-muted-foreground"
                    title="Add Sticky Note"
                  >
                    <StickyNote className="w-4 h-4 text-amber-500" />
                    <span className="hidden sm:inline text-xs font-medium">Note</span>
                  </button>
                )}
                {onAddCaptureNode && (
                  <button
                    onClick={onAddCaptureNode}
                    className="flex items-center gap-1.5 p-2 sm:px-2.5 sm:py-1.5 rounded-lg hover:bg-muted active:bg-muted/80 transition-colors text-muted-foreground"
                    title="Add Animation Capture"
                  >
                    <Video className="w-4 h-4 text-red-500" />
                    <span className="hidden sm:inline text-xs font-medium">Capture</span>
                  </button>
                )}
              </div>

              <div className="w-px h-5 bg-border mx-1 sm:mx-2" />

              <div className="flex items-center gap-1">
                <span className="hidden sm:inline text-[10px] font-mono text-muted-foreground/60 uppercase tracking-wider mr-1">
                  Actions
                </span>
                <button
                  onClick={() => onAddPromptNode("image")}
                  className="flex items-center gap-1.5 p-2 sm:px-2.5 sm:py-1.5 rounded-lg hover:bg-muted active:bg-muted/80 transition-colors text-muted-foreground"
                  title="Image Generation Prompt"
                >
                  <ImageIcon className="w-4 h-4" />
                  <span className="hidden sm:inline text-xs font-medium">Img Gen</span>
                </button>
                <button
                  onClick={() => onAddPromptNode("text")}
                  className="flex items-center gap-1.5 p-2 sm:px-2.5 sm:py-1.5 rounded-lg hover:bg-muted active:bg-muted/80 transition-colors text-muted-foreground"
                  title="Text Generation Prompt"
                >
                  <MessageSquare className="w-4 h-4" />
                  <span className="hidden sm:inline text-xs font-medium">Text Gen</span>
                </button>
              </div>

              {hasSelection && (
                <>
                  <div className="w-px h-5 bg-border ml-1 sm:ml-2" />
                  <button
                    onClick={onDeleteSelected}
                    className="flex items-center gap-1.5 p-2 sm:px-2.5 sm:py-1.5 rounded-lg hover:bg-destructive/10 active:bg-destructive/20 text-destructive transition-colors ml-0.5 sm:ml-1"
                    title="Delete Selected (Del)"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </>
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
