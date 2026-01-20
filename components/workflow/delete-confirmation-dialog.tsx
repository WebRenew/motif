"use client"

import { useState } from "react"
import { AlertTriangle } from "lucide-react"

interface DeleteConfirmationDialogProps {
  isOpen: boolean
  nodeCount: number
  onConfirm: (skipFutureConfirmations: boolean) => void
  onCancel: () => void
}

export function DeleteConfirmationDialog({
  isOpen,
  nodeCount,
  onConfirm,
  onCancel,
}: DeleteConfirmationDialogProps) {
  const [dontShowAgain, setDontShowAgain] = useState(false)

  if (!isOpen) return null

  const message =
    nodeCount === 1
      ? "Are you sure you want to delete this node?"
      : `Are you sure you want to delete ${nodeCount} nodes?`

  const details =
    nodeCount === 1
      ? "This action cannot be undone."
      : "This will also remove all connections to these nodes. This action cannot be undone."

  const handleConfirm = () => {
    onConfirm(dontShowAgain)
    setDontShowAgain(false) // Reset for next time
  }

  const handleCancel = () => {
    setDontShowAgain(false) // Reset when cancelled
    onCancel()
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={handleCancel} />

      {/* Dialog */}
      <div className="relative w-full max-w-sm mx-4 bg-card rounded-2xl border border-border shadow-2xl animate-fade-in">
        {/* Header */}
        <div className="flex items-start gap-3 px-6 py-4 border-b border-border">
          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center">
            <AlertTriangle className="w-5 h-5 text-destructive" />
          </div>
          <div className="flex-1 pt-0.5">
            <h2 className="text-lg font-semibold text-foreground">Delete {nodeCount === 1 ? "Node" : "Nodes"}</h2>
            <p className="text-sm text-muted-foreground mt-1">{message}</p>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 py-4 space-y-4">
          <p className="text-sm text-muted-foreground">{details}</p>

          {/* Don't show again checkbox */}
          <label className="flex items-center gap-2 cursor-pointer group">
            <input
              type="checkbox"
              checked={dontShowAgain}
              onChange={(e) => setDontShowAgain(e.target.checked)}
              className="w-4 h-4 rounded border-border bg-background checked:bg-destructive checked:border-destructive focus:outline-none focus:ring-2 focus:ring-white/20 focus:ring-offset-2 cursor-pointer"
            />
            <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors select-none">
              Don't ask me again
            </span>
          </label>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border">
          <button
            onClick={handleCancel}
            className="px-4 py-2 text-foreground hover:bg-muted rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            className="px-4 py-2 bg-destructive text-white rounded-lg hover:bg-destructive/90 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20 focus-visible:ring-offset-2"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  )
}
