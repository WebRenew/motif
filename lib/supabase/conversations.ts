import { createClient } from "./client"
import type { Json } from "@/lib/types/database.types"

export interface Message {
  role: "user" | "assistant" | "system"
  content: string
  metadata?: Record<string, unknown>
}

export interface Conversation {
  id: string
  userId: string
  workflowId: string | null
  title: string | null
  isFavorite: boolean
  createdAt: string
  updatedAt: string
  messages: Message[]
}

/**
 * Get or create a conversation for a workflow
 */
export async function getOrCreateConversation(
  userId: string,
  workflowId?: string
): Promise<string> {
  const supabase = createClient()

  // Try to find existing conversation for this workflow
  if (workflowId) {
    const { data: existing } = await supabase
      .from("agent_conversations")
      .select("id")
      .eq("user_id", userId)
      .eq("workflow_id", workflowId)
      .order("updated_at", { ascending: false })
      .limit(1)
      .single()

    if (existing) {
      return existing.id
    }
  }

  // Create new conversation
  const { data, error } = await supabase
    .from("agent_conversations")
    .insert({
      user_id: userId,
      workflow_id: workflowId ?? null,
    })
    .select("id")
    .single()

  if (error) throw error
  return data.id
}

/**
 * Load conversation with messages
 */
export async function loadConversation(
  conversationId: string
): Promise<Conversation | null> {
  const supabase = createClient()

  const { data: conversation, error: convError } = await supabase
    .from("agent_conversations")
    .select("*")
    .eq("id", conversationId)
    .single()

  if (convError || !conversation) return null

  const { data: messages, error: msgError } = await supabase
    .from("agent_messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })

  if (msgError) throw msgError

  return {
    id: conversation.id,
    userId: conversation.user_id,
    workflowId: conversation.workflow_id,
    title: conversation.title,
    isFavorite: conversation.is_favorite ?? false,
    createdAt: conversation.created_at!,
    updatedAt: conversation.updated_at!,
    messages: (messages ?? []).map((m) => ({
      role: m.role as Message["role"],
      content: m.content,
      metadata: m.metadata as Record<string, unknown> | undefined,
    })),
  }
}

/**
 * Save a message to a conversation
 */
export async function saveMessage(
  conversationId: string,
  message: Message
): Promise<void> {
  const supabase = createClient()

  const { error } = await supabase.from("agent_messages").insert({
    conversation_id: conversationId,
    role: message.role,
    content: message.content,
    metadata: (message.metadata as Json) ?? null,
  })

  if (error) throw error
}

/**
 * Save multiple messages at once (for initial load or batch save)
 */
export async function saveMessages(
  conversationId: string,
  messages: Message[]
): Promise<void> {
  if (messages.length === 0) return

  const supabase = createClient()

  const { error } = await supabase.from("agent_messages").insert(
    messages.map((m) => ({
      conversation_id: conversationId,
      role: m.role,
      content: m.content,
      metadata: (m.metadata as Json) ?? null,
    }))
  )

  if (error) throw error
}

/**
 * Update conversation title (e.g., from first user message)
 */
export async function updateConversationTitle(
  conversationId: string,
  title: string
): Promise<void> {
  const supabase = createClient()

  const { error } = await supabase
    .from("agent_conversations")
    .update({ title })
    .eq("id", conversationId)

  if (error) throw error
}

export interface ConversationListItem {
  id: string
  title: string | null
  updatedAt: string
  workflowId: string | null
  isFavorite: boolean
}

/**
 * List recent conversations for a user (favorites first, then by updated_at)
 */
export async function listConversations(
  userId: string,
  limit = 50
): Promise<ConversationListItem[]> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from("agent_conversations")
    .select("id, title, updated_at, workflow_id, is_favorite")
    .eq("user_id", userId)
    .order("is_favorite", { ascending: false })
    .order("updated_at", { ascending: false })
    .limit(limit)

  if (error) throw error

  return (data ?? []).map((c) => ({
    id: c.id,
    title: c.title,
    updatedAt: c.updated_at!,
    workflowId: c.workflow_id,
    isFavorite: c.is_favorite ?? false,
  }))
}

/**
 * Delete a conversation and all its messages
 */
export async function deleteConversation(conversationId: string): Promise<void> {
  const supabase = createClient()

  const { error } = await supabase
    .from("agent_conversations")
    .delete()
    .eq("id", conversationId)

  if (error) throw error
}

/**
 * Toggle favorite status of a conversation
 */
export async function toggleFavorite(
  conversationId: string,
  isFavorite: boolean
): Promise<void> {
  const supabase = createClient()

  const { error } = await supabase
    .from("agent_conversations")
    .update({ is_favorite: isFavorite })
    .eq("id", conversationId)

  if (error) throw error
}

/**
 * Rename a conversation
 */
export async function renameConversation(
  conversationId: string,
  title: string
): Promise<void> {
  const supabase = createClient()

  const { error } = await supabase
    .from("agent_conversations")
    .update({ title })
    .eq("id", conversationId)

  if (error) throw error
}
