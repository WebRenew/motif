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

export type NodeRunRequest = {
  nodeType: "combineStyles" | "extractTokens" | "generateImage" | "generateText"
  model: string
  prompt: string
  images: WorkflowImage[]
  textInputs?: WorkflowTextInput[]
}

export type NodeRunResponse = {
  success: boolean
  error?: string
  outputImage?: WorkflowImage
  text?: string
  structuredOutput?: object
}
