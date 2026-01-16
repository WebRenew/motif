export type WorkflowImage = {
  url: string
  mediaType: string
}

export type NodeRunRequest = {
  nodeType: "combineStyles" | "extractTokens" | "generateImage" | "generateText"
  model: string
  prompt: string
  images: WorkflowImage[]
}

export type NodeRunResponse = {
  success: boolean
  error?: string
  outputImage?: WorkflowImage
  text?: string
  structuredOutput?: object
}
