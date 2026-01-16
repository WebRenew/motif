"use client"

import { forwardRef } from "react"
import { ImageIcon, Sparkles, FileCode2 } from "lucide-react"

type ContextMenuProps = {
  x: number
  y: number
  onAddImageNode: () => void
  onAddImageGenPrompt: () => void
  onAddTextGenPrompt: () => void
  onAddCodeNode: () => void
}

export const ContextMenu = forwardRef<HTMLDivElement, ContextMenuProps>(
  ({ x, y, onAddImageNode, onAddImageGenPrompt, onAddTextGenPrompt, onAddCodeNode }, ref) => {
    return (
      <div
        ref={ref}
        className="fixed bg-popover border border-border rounded-lg shadow-lg z-50 py-1 min-w-[160px]"
        style={{ left: x, top: y }}
      >
        <button
          className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-muted transition-colors text-foreground"
          onClick={onAddImageNode}
        >
          <ImageIcon className="w-4 h-4" />
          Add Image
        </button>
        <button
          className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-muted transition-colors text-foreground"
          onClick={onAddImageGenPrompt}
        >
          <Sparkles className="w-4 h-4 text-violet-500" />
          Add Image Gen Prompt
        </button>
        <button
          className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-muted transition-colors text-foreground"
          onClick={onAddTextGenPrompt}
        >
          <Sparkles className="w-4 h-4 text-blue-500" />
          Add Text Gen Prompt
        </button>
        <button
          className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-muted transition-colors text-foreground"
          onClick={onAddCodeNode}
        >
          <FileCode2 className="w-4 h-4" />
          Add Code Output
        </button>
      </div>
    )
  },
)

ContextMenu.displayName = "ContextMenu"
