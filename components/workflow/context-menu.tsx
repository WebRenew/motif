"use client"

import { forwardRef, memo, useCallback } from "react"
import { ImageIcon, Sparkles, FileCode2, Save, Type } from "lucide-react"

type ContextMenuProps = {
  x: number
  y: number
  flowX: number
  flowY: number
  onAddImageNode: (position: { x: number; y: number }) => void
  onAddImageGenPrompt: (position: { x: number; y: number }, outputType: "image" | "text") => void
  onAddTextGenPrompt: (position: { x: number; y: number }, outputType: "image" | "text") => void
  onAddCodeNode: (position: { x: number; y: number }) => void
  onAddTextInputNode?: (position: { x: number; y: number }) => void
  onSaveWorkflow?: () => void
}

export const ContextMenu = memo(forwardRef<HTMLDivElement, ContextMenuProps>(
  ({ x, y, flowX, flowY, onAddImageNode, onAddImageGenPrompt, onAddTextGenPrompt, onAddCodeNode, onAddTextInputNode, onSaveWorkflow }, ref) => {
    const handleAddImageNode = useCallback(() => {
      onAddImageNode({ x: flowX, y: flowY })
    }, [onAddImageNode, flowX, flowY])

    const handleAddImageGenPrompt = useCallback(() => {
      onAddImageGenPrompt({ x: flowX, y: flowY }, "image")
    }, [onAddImageGenPrompt, flowX, flowY])

    const handleAddTextGenPrompt = useCallback(() => {
      onAddTextGenPrompt({ x: flowX, y: flowY }, "text")
    }, [onAddTextGenPrompt, flowX, flowY])

    const handleAddCodeNode = useCallback(() => {
      onAddCodeNode({ x: flowX, y: flowY })
    }, [onAddCodeNode, flowX, flowY])

    const handleAddTextInputNode = useCallback(() => {
      onAddTextInputNode?.({ x: flowX, y: flowY })
    }, [onAddTextInputNode, flowX, flowY])

    return (
      <div
        ref={ref}
        className="fixed bg-popover border border-border rounded-lg shadow-lg z-50 py-1 min-w-[180px]"
        style={{ left: x, top: y }}
      >
        <button
          className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-muted transition-colors text-foreground"
          onClick={handleAddImageNode}
        >
          <ImageIcon className="w-4 h-4" />
          Add Image
        </button>
        <button
          className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-muted transition-colors text-foreground"
          onClick={handleAddImageGenPrompt}
        >
          <Sparkles className="w-4 h-4 text-violet-500" />
          Add Image Gen Prompt
        </button>
        <button
          className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-muted transition-colors text-foreground"
          onClick={handleAddTextGenPrompt}
        >
          <Sparkles className="w-4 h-4 text-blue-500" />
          Add Text Gen Prompt
        </button>
        <button
          className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-muted transition-colors text-foreground"
          onClick={handleAddCodeNode}
        >
          <FileCode2 className="w-4 h-4" />
          Add Code Output
        </button>
        {onAddTextInputNode && (
          <button
            className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-muted transition-colors text-foreground"
            onClick={handleAddTextInputNode}
          >
            <Type className="w-4 h-4 text-blue-500" />
            Add Text Input
          </button>
        )}

        {onSaveWorkflow && (
          <>
            <div className="h-px bg-border my-1" />
            <button
              className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-muted transition-colors text-foreground"
              onClick={onSaveWorkflow}
            >
              <Save className="w-4 h-4 text-node-selected" />
              Save Current Workflow...
            </button>
          </>
        )}
      </div>
    )
  },
))

ContextMenu.displayName = "ContextMenu"
