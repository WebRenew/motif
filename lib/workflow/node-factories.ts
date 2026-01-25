import type { Node } from "@xyflow/react"
import type { StickyNoteColor, CaptureStatus } from "@/lib/types/workflow"

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

interface TextInputNodeOptions {
  label?: string
  placeholder?: string
  inputType?: "text" | "url" | "css-selector" | "number"
  required?: boolean
  value?: string
}

/**
 * Creates a new text input node
 */
export function createTextInputNode(position: Position, options: TextInputNodeOptions = {}): Node {
  return {
    id: `text-input-${crypto.randomUUID()}`,
    type: "textInputNode",
    position,
    data: {
      value: options.value || "",
      label: options.label || "Text Input",
      placeholder: options.placeholder,
      inputType: options.inputType || "text",
      required: options.required || false,
    },
  }
}

interface StickyNoteNodeOptions {
  content?: string
  color?: StickyNoteColor
  fontSize?: "sm" | "md" | "lg"
}

/**
 * Creates a new sticky note node for annotations
 */
export function createStickyNoteNode(position: Position, options: StickyNoteNodeOptions = {}): Node {
  return {
    id: `sticky-note-${crypto.randomUUID()}`,
    type: "stickyNoteNode",
    position,
    data: {
      content: options.content || "",
      color: options.color || "yellow",
      fontSize: options.fontSize || "md",
    },
  }
}

interface CaptureNodeOptions {
  url?: string
  selector?: string
  duration?: number
}

/**
 * Creates a new capture node for animation recording
 */
export function createCaptureNode(position: Position, options: CaptureNodeOptions = {}): Node {
  return {
    id: `capture-${crypto.randomUUID()}`,
    type: "captureNode",
    position,
    data: {
      url: options.url || "",
      selector: options.selector || "",
      duration: options.duration || 6,
      status: "idle" as CaptureStatus,
      progress: 0,
      currentFrame: 0,
      totalFrames: 30,
      excludedFrames: [],
    },
  }
}
