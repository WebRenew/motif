"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { History, Plus, Star, Trash2, Pencil, Check, X, MessageSquare } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  listConversations,
  deleteConversation,
  toggleFavorite,
  renameConversation,
  type ConversationListItem,
} from "@/lib/supabase/conversations"
import { toast } from "sonner"

interface ChatHistoryDropdownProps {
  userId: string
  currentConversationId: string | null
  onSelectConversation: (id: string) => void
  onNewChat: () => void
}

export function ChatHistoryDropdown({
  userId,
  currentConversationId,
  onSelectConversation,
  onNewChat,
}: ChatHistoryDropdownProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [conversations, setConversations] = useState<ConversationListItem[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState("")
  const dropdownRef = useRef<HTMLDivElement>(null)
  const editInputRef = useRef<HTMLInputElement>(null)

  // Load conversations when dropdown opens
  const loadConversations = useCallback(async () => {
    if (!userId) return
    setIsLoading(true)
    try {
      const data = await listConversations(userId)
      setConversations(data)
    } catch (err) {
      console.error("Failed to load conversations:", err)
      toast.error("Failed to load chat history")
    } finally {
      setIsLoading(false)
    }
  }, [userId])

  useEffect(() => {
    if (isOpen) {
      loadConversations()
    }
  }, [isOpen, loadConversations])

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false)
        setEditingId(null)
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside)
    }
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [isOpen])

  // Focus edit input when editing starts
  useEffect(() => {
    if (editingId && editInputRef.current) {
      editInputRef.current.focus()
      editInputRef.current.select()
    }
  }, [editingId])

  const handleToggleFavorite = async (e: React.MouseEvent, conv: ConversationListItem) => {
    e.stopPropagation()
    try {
      await toggleFavorite(conv.id, !conv.isFavorite)
      setConversations((prev) =>
        prev.map((c) => (c.id === conv.id ? { ...c, isFavorite: !c.isFavorite } : c))
      )
    } catch (err) {
      console.error("Failed to toggle favorite:", err)
      toast.error("Failed to update favorite")
    }
  }

  const handleDelete = async (e: React.MouseEvent, convId: string) => {
    e.stopPropagation()
    if (!confirm("Delete this conversation? This cannot be undone.")) return
    try {
      await deleteConversation(convId)
      setConversations((prev) => prev.filter((c) => c.id !== convId))
      if (convId === currentConversationId) {
        onNewChat()
      }
      toast.success("Conversation deleted")
    } catch (err) {
      console.error("Failed to delete conversation:", err)
      toast.error("Failed to delete conversation")
    }
  }

  const startEditing = (e: React.MouseEvent, conv: ConversationListItem) => {
    e.stopPropagation()
    setEditingId(conv.id)
    setEditTitle(conv.title || "")
  }

  const saveEdit = async (convId: string) => {
    if (!editTitle.trim()) {
      setEditingId(null)
      return
    }
    try {
      await renameConversation(convId, editTitle.trim())
      setConversations((prev) =>
        prev.map((c) => (c.id === convId ? { ...c, title: editTitle.trim() } : c))
      )
      setEditingId(null)
    } catch (err) {
      console.error("Failed to rename conversation:", err)
      toast.error("Failed to rename conversation")
    }
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditTitle("")
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    const now = new Date()
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24))
    
    if (diffDays === 0) return "Today"
    if (diffDays === 1) return "Yesterday"
    if (diffDays < 7) return `${diffDays} days ago`
    return date.toLocaleDateString()
  }

  return (
    <div ref={dropdownRef} className="relative">
      {/* Trigger buttons */}
      <div className="flex items-center gap-1">
        <button
          onClick={() => {
            onNewChat()
            setIsOpen(false)
          }}
          className="p-2 hover:bg-white/5 rounded-lg transition-colors"
          aria-label="New chat"
          title="New chat"
        >
          <Plus className="w-4 h-4 text-[#8a8a94]" />
        </button>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={cn(
            "p-2 hover:bg-white/5 rounded-lg transition-colors",
            isOpen && "bg-white/5"
          )}
          aria-label="Chat history"
          title="Chat history"
        >
          <History className="w-4 h-4 text-[#8a8a94]" />
        </button>
      </div>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-72 max-h-80 overflow-y-auto rounded-xl bg-[#1a1a1d] border border-white/10 shadow-xl z-50">
          {isLoading ? (
            <div className="p-4 text-center text-sm text-[#8a8a94]">Loading...</div>
          ) : conversations.length === 0 ? (
            <div className="p-4 text-center text-sm text-[#8a8a94]">
              No conversations yet
            </div>
          ) : (
            <div className="py-1">
              {conversations.map((conv) => (
                <div
                  key={conv.id}
                  onClick={() => {
                    if (editingId !== conv.id) {
                      onSelectConversation(conv.id)
                      setIsOpen(false)
                    }
                  }}
                  className={cn(
                    "group flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-white/5 transition-colors",
                    conv.id === currentConversationId && "bg-white/5"
                  )}
                >
                  <MessageSquare className="w-4 h-4 text-[#8a8a94] flex-shrink-0" />
                  
                  <div className="flex-1 min-w-0">
                    {editingId === conv.id ? (
                      <div className="flex items-center gap-1">
                        <input
                          ref={editInputRef}
                          type="text"
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") saveEdit(conv.id)
                            if (e.key === "Escape") cancelEdit()
                          }}
                          className="flex-1 bg-[#111114] border border-white/10 rounded px-2 py-1 text-sm text-[#f0f0f2] focus:outline-none focus:border-[#C157C1]/50"
                          onClick={(e) => e.stopPropagation()}
                        />
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            saveEdit(conv.id)
                          }}
                          className="p-1 hover:bg-white/10 rounded"
                        >
                          <Check className="w-3 h-3 text-green-400" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            cancelEdit()
                          }}
                          className="p-1 hover:bg-white/10 rounded"
                        >
                          <X className="w-3 h-3 text-[#8a8a94]" />
                        </button>
                      </div>
                    ) : (
                      <>
                        <p className="text-sm text-[#f0f0f2] truncate">
                          {conv.title || "Untitled conversation"}
                        </p>
                        <p className="text-xs text-[#8a8a94]">{formatDate(conv.updatedAt)}</p>
                      </>
                    )}
                  </div>

                  {editingId !== conv.id && (
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => handleToggleFavorite(e, conv)}
                        className="p-1 hover:bg-white/10 rounded"
                        title={conv.isFavorite ? "Remove from favorites" : "Add to favorites"}
                      >
                        <Star
                          className={cn(
                            "w-3.5 h-3.5",
                            conv.isFavorite ? "fill-yellow-400 text-yellow-400" : "text-[#8a8a94]"
                          )}
                        />
                      </button>
                      <button
                        onClick={(e) => startEditing(e, conv)}
                        className="p-1 hover:bg-white/10 rounded"
                        title="Rename"
                      >
                        <Pencil className="w-3.5 h-3.5 text-[#8a8a94]" />
                      </button>
                      <button
                        onClick={(e) => handleDelete(e, conv.id)}
                        className="p-1 hover:bg-white/10 rounded"
                        title="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-[#8a8a94] hover:text-red-400" />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
