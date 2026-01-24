export type WorkflowImage = {
  url: string
  mediaType: string
  sequenceNumber?: number
}

export type WorkflowTextInput = {
  content: string
  language?: string
  label?: string
}

export type StickyNoteColor = "yellow" | "pink" | "blue" | "green" | "purple" | "orange"

export type StickyNoteNodeData = {
  content: string
  color: StickyNoteColor
  fontSize: "sm" | "md" | "lg"
}
