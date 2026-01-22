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
