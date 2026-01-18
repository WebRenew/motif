import type { Node } from "@xyflow/react"

type Position = { x: number; y: number }

/**
 * Creates a new image node
 */
export function createImageNode(position: Position): Node {
  return {
    id: `image-${crypto.randomUUID()}`,
    type: "imageNode",
    position,
    data: { imageUrl: "", aspect: "landscape" },
  }
}

/**
 * Creates a new prompt node with specified output type
 */
export function createPromptNode(position: Position, outputType: "image" | "text" = "image"): Node {
  const defaultModel = outputType === "image" ? "google/gemini-3-pro-image" : "anthropic/claude-sonnet-4-5"

  return {
    id: `prompt-${crypto.randomUUID()}`,
    type: "promptNode",
    position,
    data: {
      title: outputType === "image" ? "Image Generation" : "Text Generation",
      prompt: "",
      model: defaultModel,
      outputType,
      status: "idle",
    },
  }
}

/**
 * Creates a new code output node
 */
export function createCodeNode(position: Position): Node {
  return {
    id: `code-${crypto.randomUUID()}`,
    type: "codeNode",
    position,
    data: {
      content: "",
      language: "css",
    },
  }
}
