"use client"

import { useState, useCallback } from "react"
import { X, Star, Heart, Sparkles, Workflow, Palette, Code, Layers, Zap, Target, Check } from "lucide-react"

const ICON_OPTIONS = [
  { value: "star", Icon: Star, label: "Star" },
  { value: "heart", Icon: Heart, label: "Heart" },
  { value: "sparkles", Icon: Sparkles, label: "Sparkles" },
  { value: "workflow", Icon: Workflow, label: "Workflow" },
  { value: "palette", Icon: Palette, label: "Palette" },
  { value: "code", Icon: Code, label: "Code" },
  { value: "layers", Icon: Layers, label: "Layers" },
  { value: "zap", Icon: Zap, label: "Zap" },
  { value: "target", Icon: Target, label: "Target" },
]

interface SaveTemplateModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (data: { name: string; icon: string; tags: string[]; description?: string }) => Promise<void>
  isSaving?: boolean
}

export function SaveTemplateModal({ isOpen, onClose, onSave, isSaving = false }: SaveTemplateModalProps) {
  const [name, setName] = useState("")
  const [selectedIcon, setSelectedIcon] = useState("workflow")
  const [tagInput, setTagInput] = useState("")
  const [tags, setTags] = useState<string[]>([])
  const [description, setDescription] = useState("")

  const handleAddTag = useCallback(() => {
    const trimmedTag = tagInput.trim().toLowerCase()
    if (trimmedTag && !tags.includes(trimmedTag) && tags.length < 5) {
      setTags([...tags, trimmedTag])
      setTagInput("")
    }
  }, [tagInput, tags])

  const handleRemoveTag = useCallback((tagToRemove: string) => {
    setTags(tags.filter((tag) => tag !== tagToRemove))
  }, [tags])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault()
        handleAddTag()
      }
    },
    [handleAddTag],
  )

  const handleSubmit = useCallback(async () => {
    if (!name.trim()) return

    await onSave({
      name: name.trim(),
      icon: selectedIcon,
      tags,
      description: description.trim() || undefined,
    })

    // Reset form
    setName("")
    setSelectedIcon("workflow")
    setTags([])
    setDescription("")
  }, [name, selectedIcon, tags, description, onSave])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full max-w-md mx-4 bg-card rounded-2xl border border-border shadow-2xl animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-lg font-semibold text-foreground">Save as Template</h2>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
            disabled={isSaving}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-4 space-y-4">
          {/* Name Input */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Template Name *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Custom Workflow"
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-node-selected focus:border-transparent"
              maxLength={50}
              disabled={isSaving}
            />
          </div>

          {/* Icon Picker */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Icon</label>
            <div className="grid grid-cols-5 gap-2">
              {ICON_OPTIONS.map(({ value, Icon, label }) => (
                <button
                  key={value}
                  onClick={() => setSelectedIcon(value)}
                  className={`
                    relative p-3 rounded-lg border-2 transition-all duration-200
                    ${
                      selectedIcon === value
                        ? "border-node-selected bg-node-selected/10"
                        : "border-border hover:border-border/60 hover:bg-muted"
                    }
                  `}
                  title={label}
                  disabled={isSaving}
                >
                  <Icon className={`w-5 h-5 mx-auto ${selectedIcon === value ? "text-node-selected" : "text-muted-foreground"}`} />
                  {selectedIcon === value && (
                    <div className="absolute -top-1 -right-1 w-4 h-4 bg-node-selected rounded-full flex items-center justify-center">
                      <Check className="w-3 h-3 text-white" />
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Description (Optional) */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Description <span className="text-muted-foreground text-xs">(optional)</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What does this workflow do?"
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-node-selected focus:border-transparent resize-none"
              rows={2}
              maxLength={200}
              disabled={isSaving}
            />
          </div>

          {/* Tags */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Tags <span className="text-muted-foreground text-xs">(optional, max 5)</span>
            </label>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Add a tag..."
                className="flex-1 px-3 py-2 bg-background border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-node-selected focus:border-transparent"
                maxLength={20}
                disabled={isSaving || tags.length >= 5}
              />
              <button
                onClick={handleAddTag}
                disabled={!tagInput.trim() || tags.length >= 5 || isSaving}
                className="px-4 py-2 bg-muted text-foreground rounded-lg hover:bg-muted/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Add
              </button>
            </div>
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 px-2 py-1 bg-node-selected/10 text-node-selected text-xs rounded-md"
                  >
                    #{tag}
                    <button
                      onClick={() => handleRemoveTag(tag)}
                      className="hover:text-node-selected/70 transition-colors"
                      disabled={isSaving}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border">
          <button
            onClick={onClose}
            className="px-4 py-2 text-foreground hover:bg-muted rounded-lg transition-colors"
            disabled={isSaving}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!name.trim() || isSaving}
            className="px-4 py-2 bg-node-selected text-white rounded-lg hover:bg-node-selected/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isSaving ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Saving...
              </>
            ) : (
              "Save Template"
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
