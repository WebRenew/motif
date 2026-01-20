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

const EMOJI_OPTIONS = [
  // Popular & Featured
  { emoji: "🚀", label: "Rocket launch space" },
  { emoji: "⭐", label: "Star favorite" },
  { emoji: "💡", label: "Lightbulb idea" },
  { emoji: "🎨", label: "Art palette paint" },
  { emoji: "🔥", label: "Fire hot" },
  { emoji: "✨", label: "Sparkles magic" },
  { emoji: "💎", label: "Gem diamond jewel" },
  { emoji: "🏆", label: "Trophy award winner" },
  { emoji: "🎯", label: "Target goal bullseye" },
  { emoji: "⚡", label: "Lightning bolt zap" },

  // Tech & Work
  { emoji: "💻", label: "Laptop computer" },
  { emoji: "📱", label: "Phone mobile" },
  { emoji: "⌨️", label: "Keyboard" },
  { emoji: "🖥️", label: "Desktop computer" },
  { emoji: "🖨️", label: "Printer" },
  { emoji: "🖱️", label: "Mouse" },
  { emoji: "💾", label: "Floppy disk save" },
  { emoji: "💿", label: "CD disc" },
  { emoji: "📀", label: "DVD" },
  { emoji: "🔌", label: "Plug electric" },
  { emoji: "🔋", label: "Battery power" },
  { emoji: "📡", label: "Satellite antenna" },
  { emoji: "🔬", label: "Microscope science" },
  { emoji: "🔭", label: "Telescope" },
  { emoji: "📊", label: "Chart bar graph" },
  { emoji: "📈", label: "Chart increasing trend" },
  { emoji: "📉", label: "Chart decreasing" },

  // Files & Documents
  { emoji: "📝", label: "Memo note write" },
  { emoji: "📄", label: "Page document" },
  { emoji: "📃", label: "Paper" },
  { emoji: "📋", label: "Clipboard" },
  { emoji: "📁", label: "Folder directory" },
  { emoji: "📂", label: "Open folder" },
  { emoji: "🗂️", label: "File dividers" },
  { emoji: "📚", label: "Books library" },
  { emoji: "📖", label: "Open book" },
  { emoji: "📕", label: "Closed book red" },
  { emoji: "📗", label: "Green book" },
  { emoji: "📘", label: "Blue book" },
  { emoji: "📙", label: "Orange book" },
  { emoji: "📓", label: "Notebook" },

  // Tools & Settings
  { emoji: "🔧", label: "Wrench tool" },
  { emoji: "⚙️", label: "Gear settings config" },
  { emoji: "🔨", label: "Hammer tool build" },
  { emoji: "⚒️", label: "Hammer pick" },
  { emoji: "🛠️", label: "Tools" },
  { emoji: "⛏️", label: "Pick axe" },
  { emoji: "🔩", label: "Nut bolt" },
  { emoji: "⚗️", label: "Alembic chemistry" },
  { emoji: "🧪", label: "Test tube" },
  { emoji: "🧬", label: "DNA genetics" },

  // Communication
  { emoji: "💬", label: "Speech balloon chat" },
  { emoji: "💭", label: "Thought bubble" },
  { emoji: "🗨️", label: "Speech left" },
  { emoji: "🗯️", label: "Anger bubble" },
  { emoji: "📢", label: "Loudspeaker announcement" },
  { emoji: "📣", label: "Megaphone" },
  { emoji: "📞", label: "Phone receiver" },
  { emoji: "📧", label: "Email envelope" },
  { emoji: "📨", label: "Incoming envelope" },
  { emoji: "📩", label: "Envelope arrow" },
  { emoji: "✉️", label: "Envelope mail" },

  // Time & Calendar
  { emoji: "⏰", label: "Alarm clock" },
  { emoji: "⏱️", label: "Stopwatch timer" },
  { emoji: "⏲️", label: "Timer clock" },
  { emoji: "🕐", label: "Clock one" },
  { emoji: "⌛", label: "Hourglass done" },
  { emoji: "⏳", label: "Hourglass flowing" },
  { emoji: "📅", label: "Calendar date" },
  { emoji: "📆", label: "Calendar tear-off" },

  // Weather & Nature
  { emoji: "☀️", label: "Sun sunny" },
  { emoji: "🌙", label: "Moon night crescent" },
  { emoji: "⭐", label: "Star white" },
  { emoji: "🌟", label: "Glowing star shine" },
  { emoji: "✨", label: "Sparkles" },
  { emoji: "⚡", label: "Lightning" },
  { emoji: "🔥", label: "Fire flame" },
  { emoji: "💧", label: "Droplet water" },
  { emoji: "🌊", label: "Wave water" },
  { emoji: "☁️", label: "Cloud" },
  { emoji: "🌈", label: "Rainbow" },
  { emoji: "❄️", label: "Snowflake ice" },
  { emoji: "🌸", label: "Cherry blossom flower" },
  { emoji: "🌺", label: "Hibiscus flower" },
  { emoji: "🌻", label: "Sunflower" },
  { emoji: "🌹", label: "Rose flower" },
  { emoji: "🌷", label: "Tulip flower" },
  { emoji: "🌱", label: "Seedling plant" },
  { emoji: "🌲", label: "Evergreen tree" },
  { emoji: "🌳", label: "Deciduous tree" },
  { emoji: "🌴", label: "Palm tree" },
  { emoji: "🍀", label: "Four leaf clover luck" },

  // Objects & Symbols
  { emoji: "💼", label: "Briefcase work business" },
  { emoji: "🎒", label: "Backpack bag" },
  { emoji: "👑", label: "Crown king royal" },
  { emoji: "💍", label: "Ring diamond" },
  { emoji: "🔑", label: "Key unlock" },
  { emoji: "🔒", label: "Lock locked" },
  { emoji: "🔓", label: "Unlock unlocked" },
  { emoji: "🔐", label: "Locked key" },
  { emoji: "🗝️", label: "Old key" },
  { emoji: "🎁", label: "Gift present" },
  { emoji: "🎈", label: "Balloon party" },
  { emoji: "🎉", label: "Party popper celebration" },
  { emoji: "🎊", label: "Confetti ball" },

  // Creative & Art
  { emoji: "🎭", label: "Theater masks drama" },
  { emoji: "🎪", label: "Circus tent" },
  { emoji: "🎬", label: "Clapper board film" },
  { emoji: "🎤", label: "Microphone sing" },
  { emoji: "🎧", label: "Headphone music" },
  { emoji: "🎵", label: "Musical note" },
  { emoji: "🎶", label: "Musical notes" },
  { emoji: "🎹", label: "Musical keyboard piano" },
  { emoji: "🎸", label: "Guitar music" },
  { emoji: "🎺", label: "Trumpet" },
  { emoji: "🎻", label: "Violin" },
  { emoji: "🥁", label: "Drum" },
  { emoji: "📸", label: "Camera flash photo" },
  { emoji: "📷", label: "Camera" },
  { emoji: "📹", label: "Video camera" },
  { emoji: "🎥", label: "Movie camera film" },
  { emoji: "🖼️", label: "Framed picture" },
  { emoji: "🖌️", label: "Paintbrush" },
  { emoji: "🖍️", label: "Crayon" },

  // Sports & Games
  { emoji: "🎮", label: "Video game controller gaming" },
  { emoji: "🕹️", label: "Joystick" },
  { emoji: "🎲", label: "Dice game random" },
  { emoji: "♟️", label: "Chess pawn" },
  { emoji: "🎯", label: "Direct hit target" },
  { emoji: "🏀", label: "Basketball" },
  { emoji: "⚽", label: "Soccer ball football" },
  { emoji: "🏈", label: "American football" },
  { emoji: "⚾", label: "Baseball" },
  { emoji: "🎾", label: "Tennis" },
  { emoji: "🏐", label: "Volleyball" },

  // Arrows & Directions
  { emoji: "➡️", label: "Right arrow" },
  { emoji: "⬅️", label: "Left arrow" },
  { emoji: "⬆️", label: "Up arrow" },
  { emoji: "⬇️", label: "Down arrow" },
  { emoji: "↗️", label: "Up-right arrow" },
  { emoji: "↘️", label: "Down-right arrow" },
  { emoji: "↙️", label: "Down-left arrow" },
  { emoji: "↖️", label: "Up-left arrow" },
  { emoji: "🔄", label: "Counterclockwise arrows refresh" },
  { emoji: "🔃", label: "Clockwise arrows" },
  { emoji: "🔁", label: "Repeat arrows loop" },
  { emoji: "🔀", label: "Shuffle tracks" },

  // Symbols & Shapes
  { emoji: "❤️", label: "Red heart love" },
  { emoji: "🧡", label: "Orange heart" },
  { emoji: "💛", label: "Yellow heart" },
  { emoji: "💚", label: "Green heart" },
  { emoji: "💙", label: "Blue heart" },
  { emoji: "💜", label: "Purple heart" },
  { emoji: "🖤", label: "Black heart" },
  { emoji: "🤍", label: "White heart" },
  { emoji: "💯", label: "Hundred points" },
  { emoji: "✅", label: "Check mark green tick" },
  { emoji: "✔️", label: "Check mark" },
  { emoji: "❌", label: "Cross mark X cancel" },
  { emoji: "⭕", label: "Hollow red circle O" },
  { emoji: "❗", label: "Exclamation mark red" },
  { emoji: "❓", label: "Question mark" },
  { emoji: "⚠️", label: "Warning caution alert" },
  { emoji: "🔴", label: "Red circle" },
  { emoji: "🟠", label: "Orange circle" },
  { emoji: "🟡", label: "Yellow circle" },
  { emoji: "🟢", label: "Green circle" },
  { emoji: "🔵", label: "Blue circle" },
  { emoji: "🟣", label: "Purple circle" },
  { emoji: "⚫", label: "Black circle" },
  { emoji: "⚪", label: "White circle" },
  { emoji: "🟥", label: "Red square" },
  { emoji: "🟧", label: "Orange square" },
  { emoji: "🟨", label: "Yellow square" },
  { emoji: "🟩", label: "Green square" },
  { emoji: "🟦", label: "Blue square" },
  { emoji: "🟪", label: "Purple square" },
  { emoji: "⬛", label: "Black square" },
  { emoji: "⬜", label: "White square" },

  // Animals & Fantasy
  { emoji: "🦄", label: "Unicorn magical fantasy" },
  { emoji: "🐉", label: "Dragon fantasy" },
  { emoji: "🦋", label: "Butterfly" },
  { emoji: "🐝", label: "Honeybee bee" },
  { emoji: "🦅", label: "Eagle bird" },
  { emoji: "🦉", label: "Owl bird" },
  { emoji: "🐺", label: "Wolf" },
  { emoji: "🦁", label: "Lion" },
  { emoji: "🐯", label: "Tiger face" },
  { emoji: "🐻", label: "Bear" },
  { emoji: "🐼", label: "Panda" },

  // Food & Drink
  { emoji: "☕", label: "Coffee hot beverage" },
  { emoji: "🍵", label: "Teacup tea" },
  { emoji: "🍺", label: "Beer mug" },
  { emoji: "🍕", label: "Pizza slice" },
  { emoji: "🍔", label: "Hamburger burger" },
  { emoji: "🍰", label: "Cake dessert" },
  { emoji: "🎂", label: "Birthday cake" },
  { emoji: "🍪", label: "Cookie" },
  { emoji: "🍩", label: "Doughnut donut" },
  { emoji: "🍎", label: "Red apple fruit" },
  { emoji: "🍊", label: "Orange fruit" },
  { emoji: "🍋", label: "Lemon fruit" },
  { emoji: "🍌", label: "Banana fruit" },
  { emoji: "🍇", label: "Grapes fruit" },
  { emoji: "🍓", label: "Strawberry fruit" },

  // Miscellaneous
  { emoji: "💪", label: "Flexed biceps strong muscle" },
  { emoji: "👍", label: "Thumbs up good like" },
  { emoji: "👎", label: "Thumbs down bad dislike" },
  { emoji: "👏", label: "Clapping hands applause" },
  { emoji: "🙌", label: "Raising hands celebration" },
  { emoji: "✋", label: "Raised hand stop" },
  { emoji: "👋", label: "Waving hand hello bye" },
  { emoji: "✌️", label: "Victory hand peace" },
  { emoji: "🤝", label: "Handshake agreement" },
  { emoji: "👀", label: "Eyes looking watch" },
  { emoji: "🧠", label: "Brain smart think" },
  { emoji: "🫀", label: "Anatomical heart" },
  { emoji: "🗺️", label: "World map" },
  { emoji: "🧭", label: "Compass navigation" },
  { emoji: "🔦", label: "Flashlight torch" },
  { emoji: "💫", label: "Dizzy star" },
  { emoji: "🌐", label: "Globe meridians web internet" },
  { emoji: "🔮", label: "Crystal ball fortune magic" },
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
  const [emojiSearch, setEmojiSearch] = useState("")
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
    setEmojiSearch("")
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

            {/* Emoji Grid */}
            {iconType === "emoji" && (
              <div
                id="emoji-panel"
                role="tabpanel"
                aria-labelledby="emoji-tab"
                className="space-y-3"
              >
                {/* Search Input */}
                <input
                  type="text"
                  value={emojiSearch}
                  onChange={(e) => setEmojiSearch(e.target.value)}
                  placeholder="Search emojis..."
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-white/20 focus:border-white/20"
                  autoComplete="off"
                  disabled={isSaving}
                  aria-label="Search emojis"
                />

                {/* Emoji Grid */}
                <div
                  id="emoji-grid"
                  className="grid grid-cols-6 gap-2 max-h-[200px] overflow-y-scroll p-1 pr-2"
                  style={{
                    scrollbarWidth: "thin",
                    scrollbarColor: "rgba(0, 0, 0, 0.25) transparent",
                    scrollbarGutter: "stable",
                  }}
                >
                  {EMOJI_OPTIONS.filter(({ label }) =>
                    emojiSearch.trim() === "" || label.toLowerCase().includes(emojiSearch.toLowerCase())
                  ).map(({ emoji, label }) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => setEmojiInput(emoji)}
                      className={`
                        relative p-2.5 rounded-lg border-2 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20 focus-visible:ring-offset-1
                        ${
                          emojiInput === emoji
                            ? "border-white/20 bg-[#2a2a2f]"
                            : "border-border hover:border-border/60 hover:bg-muted"
                        }
                      `}
                      title={label}
                      aria-label={label}
                      aria-pressed={emojiInput === emoji}
                      disabled={isSaving}
                    >
                      <span className="text-xl block text-center">{emoji}</span>
                      {emojiInput === emoji && (
                        <div className="absolute -top-1 -right-1 w-4 h-4 bg-[#111114] border border-white/10 rounded-full flex items-center justify-center" aria-hidden="true">
                          <Check className="w-2.5 h-2.5 text-[#f0f0f2]" />
                        </div>
                      )}
                    </button>
                  ))}
                </div>
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
                    className="inline-flex items-center gap-1 px-2 py-1 bg-muted text-foreground border border-border text-xs rounded-md"
                  >
                    #{tag}
                    <button
                      onClick={() => handleRemoveTag(tag)}
                      className="hover:text-foreground/70 transition-colors"
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
