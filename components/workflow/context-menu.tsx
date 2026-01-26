"use client"

import { forwardRef, memo, useCallback } from "react"
import { ImageIcon, Sparkles, FileCode2, Save, Type, StickyNote, Video } from "lucide-react"

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
  onAddStickyNoteNode?: (position: { x: number; y: number }) => void
  onAddCaptureNode?: (position: { x: number; y: number }) => void
  onSaveWorkflow?: () => void
}

export const ContextMenu = memo(forwardRef<HTMLDivElement, ContextMenuProps>(
  ({ x, y, flowX, flowY, onAddImageNode, onAddImageGenPrompt, onAddTextGenPrompt, onAddCodeNode, onAddTextInputNode, onAddStickyNoteNode, onAddCaptureNode, onSaveWorkflow }, ref) => {
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

    const handleAddStickyNoteNode = useCallback(() => {
      onAddStickyNoteNode?.({ x: flowX, y: flowY })
    }, [onAddStickyNoteNode, flowX, flowY])

    const handleAddCaptureNode = useCallback(() => {
      onAddCaptureNode?.({ x: flowX, y: flowY })
    }, [onAddCaptureNode, flowX, flowY])

    return (
      <div
        ref={ref}
        className="fixed bg-popover border border-border rounded-lg shadow-lg z-50 py-1 min-w-[180px]"
        style={{ left: x, top: y }}
      >
        {/* Inputs Section */}
        <div className="px-3 py-1">
          <span className="text-[10px] font-mono text-muted-foreground/60 uppercase tracking-wider">Inputs</span>
        </div>
        <button
          className="group flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-blue-500/10 transition-colors text-foreground"
          onClick={handleAddImageNode}
        >
          <ImageIcon className="w-4 h-4 text-muted-foreground group-hover:text-blue-500 transition-colors" />
          Add Image
        </button>
        <button
          className="group flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-emerald-500/10 transition-colors text-foreground"
          onClick={handleAddCodeNode}
        >
          <FileCode2 className="w-4 h-4 text-muted-foreground group-hover:text-emerald-500 transition-colors" />
          Add Code Output
        </button>
        {onAddTextInputNode && (
          <button
            className="group flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-sky-500/10 transition-colors text-foreground"
            onClick={handleAddTextInputNode}
          >
            <Type className="w-4 h-4 text-muted-foreground group-hover:text-sky-500 transition-colors" />
            Add Text Input
          </button>
        )}
        {onAddCaptureNode && (
          <button
            className="group flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-red-500/10 transition-colors text-foreground"
            onClick={handleAddCaptureNode}
          >
            <Video className="w-4 h-4 text-muted-foreground group-hover:text-red-500 transition-colors" />
            Add Animation Capture
          </button>
        )}

        {/* Agents Section */}
        <div className="h-px bg-border my-1" />
        <div className="px-3 py-1">
          <span className="text-[10px] font-mono text-muted-foreground/60 uppercase tracking-wider">Agents</span>
        </div>
        <button
          className="group flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-violet-500/10 transition-colors text-foreground"
          onClick={handleAddImageGenPrompt}
        >
          <Sparkles className="w-4 h-4 text-muted-foreground group-hover:text-violet-500 transition-colors" />
          Add Image Gen Prompt
        </button>
        <button
          className="group flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-amber-500/10 transition-colors text-foreground"
          onClick={handleAddTextGenPrompt}
        >
          <Sparkles className="w-4 h-4 text-muted-foreground group-hover:text-amber-500 transition-colors" />
          Add Text Gen Prompt
        </button>

        {/* Utilities Section */}
        {onAddStickyNoteNode && (
          <>
            <div className="h-px bg-border my-1" />
            <div className="px-3 py-1">
              <span className="text-[10px] font-mono text-muted-foreground/60 uppercase tracking-wider">Utilities</span>
            </div>
            <button
              className="group flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-amber-500/10 transition-colors text-foreground"
              onClick={handleAddStickyNoteNode}
            >
              <StickyNote className="w-4 h-4 text-muted-foreground group-hover:text-amber-500 transition-colors" />
              Add Sticky Note
            </button>
          </>
        )}

        {onSaveWorkflow && (
          <>
            <div className="h-px bg-border my-1" />
            <button
              className="group flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-node-selected/10 transition-colors text-foreground"
              onClick={onSaveWorkflow}
            >
              <Save className="w-4 h-4 text-muted-foreground group-hover:text-node-selected transition-colors" />
              Save Current Workflow...
            </button>
          </>
        )}
      </div>
    )
  },
))

ContextMenu.displayName = "ContextMenu"
