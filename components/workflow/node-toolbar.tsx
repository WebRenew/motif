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

import { ImageIcon, MessageSquare, Trash2, FileCode2 } from "lucide-react"

type NodeToolbarProps = {
  onAddImageNode: () => void
  onAddPromptNode: (outputType: "image" | "text") => void
  onAddCodeNode: () => void
  onDeleteSelected: () => void
  hasSelection: boolean
}

export function NodeToolbar({
  onAddImageNode,
  onAddPromptNode,
  onAddCodeNode,
  onDeleteSelected,
  hasSelection,
}: NodeToolbarProps) {
  return (
    <>
      <div className="absolute bottom-4 right-4 z-10">
        <div className="flex items-center gap-1 bg-card/90 backdrop-blur-sm rounded-2xl px-3 py-2 shadow-md border border-border">
          <div className="flex items-center gap-1">
            <span className="text-[10px] font-mono text-muted-foreground/60 uppercase tracking-wider mr-1">Data</span>
            <button
              onClick={onAddImageNode}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground"
              title="Add Image (Input or Output)"
            >
              <ImageIcon className="w-4 h-4" />
              <span className="text-xs font-medium">Image</span>
            </button>
            <button
              onClick={onAddCodeNode}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground"
              title="Add Code Block"
            >
              <FileCode2 className="w-4 h-4" />
              <span className="text-xs font-medium">Code</span>
            </button>
          </div>

          <div className="w-px h-5 bg-border mx-2" />

          <div className="flex items-center gap-1">
            <span className="text-[10px] font-mono text-muted-foreground/60 uppercase tracking-wider mr-1">
              Actions
            </span>
            <button
              onClick={() => onAddPromptNode("image")}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground"
              title="Image Generation Prompt"
            >
              <ImageIcon className="w-4 h-4" />
              <span className="text-xs font-medium">Img Gen</span>
            </button>
            <button
              onClick={() => onAddPromptNode("text")}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground"
              title="Text Generation Prompt"
            >
              <MessageSquare className="w-4 h-4" />
              <span className="text-xs font-medium">Text Gen</span>
            </button>
          </div>

          {hasSelection && (
            <>
              <div className="w-px h-5 bg-border ml-2" />
              <button
                onClick={onDeleteSelected}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg hover:bg-destructive/10 text-destructive transition-colors ml-1"
                title="Delete Selected (Del)"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </>
          )}
        </div>
      </div>

      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-0">
        <div className="flex items-center gap-3 text-[10px] text-muted-foreground/50 font-mono tracking-wide">
          <span>Scroll to zoom</span>
          <span className="text-muted-foreground/30">·</span>
          <span>Drag to pan</span>
          <span className="text-muted-foreground/30">·</span>
          <span>Right-click to add</span>
        </div>
      </div>
    </>
  )
}
