"use client"

import { useState, useCallback } from "react"
import {
  X,
  Star,
  Heart,
  Sparkles,
  Workflow,
  Palette,
  Code,
  Layers,
  Zap,
  Target,
  Check,
  Bookmark,
  Flag,
  Trophy,
  Lightbulb,
  Box,
  Database,
  Globe,
  Image,
  Layout,
  Settings,
  Users,
  Rocket,
  Cloud,
  CheckCircle,
  Circle,
  Square,
  Hexagon,
  Triangle,
  Diamond,
  Gem,
  Crown,
  Flame,
  Sun,
  Moon,
  Coffee,
  Briefcase,
  FileText,
  FolderOpen,
} from "lucide-react"

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
  { value: "bookmark", Icon: Bookmark, label: "Bookmark" },
  { value: "flag", Icon: Flag, label: "Flag" },
  { value: "trophy", Icon: Trophy, label: "Trophy" },
  { value: "lightbulb", Icon: Lightbulb, label: "Lightbulb" },
  { value: "box", Icon: Box, label: "Box" },
  { value: "database", Icon: Database, label: "Database" },
  { value: "globe", Icon: Globe, label: "Globe" },
  { value: "image", Icon: Image, label: "Image" },
  { value: "layout", Icon: Layout, label: "Layout" },
  { value: "settings", Icon: Settings, label: "Settings" },
  { value: "users", Icon: Users, label: "Users" },
  { value: "rocket", Icon: Rocket, label: "Rocket" },
  { value: "cloud", Icon: Cloud, label: "Cloud" },
  { value: "checkcircle", Icon: CheckCircle, label: "Check Circle" },
  { value: "circle", Icon: Circle, label: "Circle" },
  { value: "square", Icon: Square, label: "Square" },
  { value: "hexagon", Icon: Hexagon, label: "Hexagon" },
  { value: "triangle", Icon: Triangle, label: "Triangle" },
  { value: "diamond", Icon: Diamond, label: "Diamond" },
  { value: "gem", Icon: Gem, label: "Gem" },
  { value: "crown", Icon: Crown, label: "Crown" },
  { value: "flame", Icon: Flame, label: "Flame" },
  { value: "sun", Icon: Sun, label: "Sun" },
  { value: "moon", Icon: Moon, label: "Moon" },
  { value: "coffee", Icon: Coffee, label: "Coffee" },
  { value: "briefcase", Icon: Briefcase, label: "Briefcase" },
  { value: "filetext", Icon: FileText, label: "File" },
  { value: "folderopen", Icon: FolderOpen, label: "Folder" },
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
  const [iconType, setIconType] = useState<"icon" | "emoji">("icon")
  const [emojiInput, setEmojiInput] = useState("")
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

    // Use emoji if in emoji mode and has value, otherwise use selected icon
    const iconValue = iconType === "emoji" && emojiInput.trim() ? emojiInput.trim() : selectedIcon

    await onSave({
      name: name.trim(),
      icon: iconValue,
      tags,
      description: description.trim() || undefined,
    })

    // Reset form
    setName("")
    setSelectedIcon("workflow")
    setIconType("icon")
    setEmojiInput("")
    setTags([])
    setDescription("")
  }, [name, selectedIcon, iconType, emojiInput, tags, description, onSave])

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
            className="p-1 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20"
            disabled={isSaving}
            aria-label="Close"
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
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-white/20 focus:border-white/20"
              maxLength={50}
              disabled={isSaving}
            />
          </div>

          {/* Icon Picker */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Icon</label>

            {/* Tab Switcher */}
            <div className="flex gap-2 mb-3" role="tablist" aria-label="Icon type selection">
              <button
                type="button"
                role="tab"
                aria-selected={iconType === "icon"}
                aria-controls="icon-panel"
                onClick={() => setIconType("icon")}
                disabled={isSaving}
                className={`
                  flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20 focus-visible:ring-offset-2
                  ${
                    iconType === "icon"
                      ? "bg-[#111114] text-[#f0f0f2] border border-white/10"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  }
                `}
              >
                Icons
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={iconType === "emoji"}
                aria-controls="emoji-panel"
                onClick={() => setIconType("emoji")}
                disabled={isSaving}
                className={`
                  flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20 focus-visible:ring-offset-2
                  ${
                    iconType === "emoji"
                      ? "bg-[#111114] text-[#f0f0f2] border border-white/10"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  }
                `}
              >
                Emoji
              </button>
            </div>

            {/* Icon Grid */}
            {iconType === "icon" && (
              <div
                id="icon-panel"
                role="tabpanel"
                aria-labelledby="icons-tab"
                className="grid grid-cols-6 gap-2 max-h-[200px] overflow-y-scroll p-1 pr-2"
                style={{
                  scrollbarWidth: "thin",
                  scrollbarColor: "rgba(0, 0, 0, 0.25) transparent",
                  scrollbarGutter: "stable",
                }}
              >
                {ICON_OPTIONS.map(({ value, Icon, label }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setSelectedIcon(value)}
                    className={`
                      relative p-2.5 rounded-lg border-2 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20 focus-visible:ring-offset-1
                      ${
                        selectedIcon === value
                          ? "border-white/20 bg-[#2a2a2f]"
                          : "border-border hover:border-border/60 hover:bg-muted"
                      }
                    `}
                    title={label}
                    aria-label={label}
                    aria-pressed={selectedIcon === value}
                    disabled={isSaving}
                  >
                    <Icon
                      className={`w-4 h-4 mx-auto ${selectedIcon === value ? "text-[#f0f0f2]" : "text-muted-foreground"}`}
                    />
                    {selectedIcon === value && (
                      <div className="absolute -top-1 -right-1 w-4 h-4 bg-[#111114] border border-white/10 rounded-full flex items-center justify-center" aria-hidden="true">
                        <Check className="w-2.5 h-2.5 text-[#f0f0f2]" />
                      </div>
                    )}
                  </button>
                ))}
              </div>
            )}

            {/* Emoji Input */}
            {iconType === "emoji" && (
              <div
                id="emoji-panel"
                role="tabpanel"
                aria-labelledby="emoji-tab"
                className="space-y-2"
              >
                <div className="relative">
                  <input
                    type="text"
                    value={emojiInput}
                    onChange={(e) => setEmojiInput(e.target.value)}
                    placeholder="Paste or type an emoji (e.g., 🚀 or ⭐)"
                    className="w-full px-3 py-2 pr-12 bg-background border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-white/20 focus:border-white/20"
                    maxLength={2}
                    autoComplete="off"
                    disabled={isSaving}
                    aria-label="Emoji input"
                  />
                  {emojiInput && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 text-2xl" aria-hidden="true">
                      {emojiInput}
                    </div>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  Common emojis: 🚀 ⭐ 💡 🎨 📊 🔥 ✨ 💻 📱 🎯 🏆 💎 ☀️ 🌙 ☁️ 📝 📁 🔧 ⚙️ 🎉
                </p>
              </div>
            )}
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
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-white/20 focus:border-white/20 resize-none"
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
                className="flex-1 px-3 py-2 bg-background border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-white/20 focus:border-white/20"
                maxLength={20}
                disabled={isSaving || tags.length >= 5}
              />
              <button
                onClick={handleAddTag}
                disabled={!tagInput.trim() || tags.length >= 5 || isSaving}
                className="px-4 py-2 bg-muted text-foreground rounded-lg hover:bg-muted/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20"
              >
                Add
              </button>
            </div>
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 px-2 py-1 bg-white/5 text-[#f0f0f2] border border-white/10 text-xs rounded-md"
                  >
                    #{tag}
                    <button
                      onClick={() => handleRemoveTag(tag)}
                      className="hover:text-[#f0f0f2]/70 transition-colors"
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
            className="px-4 py-2 text-foreground hover:bg-muted rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20"
            disabled={isSaving}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!name.trim() || isSaving}
            className="px-4 py-2 bg-[#111114] text-[#f0f0f2] border border-white/10 rounded-lg hover:bg-[#1a1a1f] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20 focus-visible:ring-offset-2"
          >
            {isSaving ? (
              <>
                <div className="w-4 h-4 border-2 border-[#f0f0f2]/30 border-t-[#f0f0f2] rounded-full animate-spin" />
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
