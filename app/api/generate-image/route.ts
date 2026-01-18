import { NextResponse } from "next/server"
import { generateText, experimental_generateImage, generateObject } from "ai"
import { tailwindThemeSchema, themeToCss } from "@/lib/schemas/tailwind-theme"
import { genericCodeSchema, jsonOutputSchema } from "@/lib/schemas/code-output"
import type { WorkflowImage, WorkflowTextInput } from "@/lib/types/workflow"
import { checkRateLimit, USER_LIMIT, GLOBAL_LIMIT } from "@/lib/rate-limit"

export const maxDuration = 300

// Model categories for routing
const GEMINI_IMAGE_MODELS = ["google/gemini-3-pro-image", "google/gemini-2.5-flash-image"]
const IMAGE_ONLY_MODELS = ["bfl/flux-2-pro", "bfl/flux-kontext-pro", "google/imagen-4.0-generate-001"]
const VISION_TEXT_MODELS = [
  "openai/gpt-4o",
  "openai/gpt-4o-mini",
  "openai/gpt-4.1",
  "openai/gpt-4-turbo",
  "openai/gpt-5",
  "openai/gpt-5-mini",
  "openai/gpt-5.1",
  "openai/gpt-5.2",
  "anthropic/claude-sonnet-4.5",
  "anthropic/claude-sonnet-4-5",
  "anthropic/claude-sonnet-4",
  "anthropic/claude-opus-4.5",
  "anthropic/claude-opus-4",
  "anthropic/claude-haiku-4.5",
  "anthropic/claude-3.7-sonnet",
  "anthropic/claude-3.5-sonnet",
  "anthropic/claude-3-5-sonnet",
  "google/gemini-3-pro-preview",
  "google/gemini-3-flash",
  "google/gemini-2.5-pro",
  "google/gemini-2.5-flash",
  "google/gemini-2.5-flash-lite",
  "google/gemini-2.0-flash",
  "xai/grok-2-vision",
  "xai/grok-4",
  "mistral/pixtral-12b",
  "mistral/pixtral-large",
  "zai/glm-4.6v",
  "zai/glm-4.6v-flash",
  "zai/glm-4.5v",
  "alibaba/qwen3-vl-thinking",
  "alibaba/qwen3-vl-instruct",
]
const TEXT_ONLY_MODELS = ["xai/grok-code-fast-1", "xai/grok-3-fast", "xai/grok-3-mini-fast"]

const IMAGE_GENERATION_SYSTEM_PROMPT = `You are an expert image generation assistant that creates new images by ANALYZING and BLENDING reference images provided by the user.

CRITICAL INSTRUCTION: When reference images are provided, you MUST:
1. CAREFULLY ANALYZE each reference image for:
   - Color palette and color relationships
   - Typography style, weight, and hierarchy
   - Layout structure and spacing rhythm
   - Visual elements (buttons, cards, icons, gradients, shadows)
   - Overall mood and aesthetic (dark/light, minimal/bold, corporate/playful)

2. SYNTHESIZE a new design that:
   - Combines the strongest elements from each reference
   - Creates a harmonious blend, not a jarring collision
   - Maintains visual coherence and professional quality
   - Preserves the best design patterns observed

3. OUTPUT a high-fidelity image that clearly shows influence from ALL reference images.

DO NOT ignore the reference images. The output MUST visibly incorporate elements from the provided references.`

const TAILWIND_THEME_SYSTEM_PROMPT = `You are an expert design systems engineer specializing in Tailwind CSS v4 themes.

Analyze the provided design and extract a comprehensive theme configuration:
- Use oklch() color format for all colors
- Derive typography from visual hierarchy observed
- Extract spacing rhythm from the layout
- Note shadow depths and border radius patterns
- Identify any gradient usage

Be precise and consistent. Output values that will work directly in Tailwind v4's @theme directive.`

const LANGUAGE_SYSTEM_PROMPTS: Record<string, string> = {
  tsx: `You are an expert React/TypeScript developer. Generate clean, production-ready TSX components using:
- Functional components with TypeScript interfaces for props
- Tailwind CSS for styling (inline className)
- Proper semantic HTML elements
- Accessible markup (aria labels, roles where needed)
- No external dependencies unless specified
Output ONLY the code, no explanations.`,

  jsx: `You are an expert React developer. Generate clean JSX components using:
- Functional components with prop destructuring
- Tailwind CSS for styling (inline className)
- Proper semantic HTML elements
Output ONLY the code, no explanations.`,

  css: `You are an expert CSS developer. Generate clean, modern CSS using:
- CSS custom properties for theming
- Logical, well-organized selectors
- Mobile-first responsive design
- Modern features (grid, flexbox, clamp, oklch colors)
Output ONLY the CSS code, no explanations.`,

  json: `You are a data structure expert. Generate well-formatted JSON that is:
- Valid and properly nested
- Uses descriptive key names
- Follows consistent naming conventions (camelCase)
Output ONLY valid JSON, no explanations or markdown.`,

  typescript: `You are an expert TypeScript developer. Generate clean, type-safe code using:
- Proper type annotations and interfaces
- Modern ES6+ features
- Clean, readable formatting
Output ONLY the code, no explanations.`,

  javascript: `You are an expert JavaScript developer. Generate clean, modern code using:
- ES6+ syntax (const, let, arrow functions, destructuring)
- Clear function and variable naming
- JSDoc comments for complex logic
Output ONLY the code, no explanations.`,

  mdx: `You are a technical writer. Generate MDX content that:
- Uses proper markdown formatting
- Includes React components where appropriate
- Has clear headings and structure
Output ONLY the MDX content, no explanations.`,
}

function toImagePart(img: WorkflowImage): { type: "image"; image: URL | string; mediaType?: string } {
  if (img.url.startsWith("http://") || img.url.startsWith("https://")) {
    return { type: "image", image: new URL(img.url), mediaType: img.mediaType }
  }
  return { type: "image", image: img.url, mediaType: img.mediaType }
}

function uint8ToBase64(u8: Uint8Array): string {
  return Buffer.from(u8).toString("base64")
}

function getModelType(model: string): "GEMINI_IMAGE" | "IMAGE_ONLY" | "VISION_TEXT" | "TEXT_ONLY" | "UNKNOWN" {
  if (GEMINI_IMAGE_MODELS.some((m) => model.includes(m))) return "GEMINI_IMAGE"
  if (IMAGE_ONLY_MODELS.some((m) => model.includes(m))) return "IMAGE_ONLY"
  if (VISION_TEXT_MODELS.some((m) => model.includes(m))) return "VISION_TEXT"
  if (TEXT_ONLY_MODELS.some((m) => model.includes(m))) return "TEXT_ONLY"
  return "UNKNOWN"
}

function isStylesheetRequest(prompt: string): boolean {
  const lower = prompt.toLowerCase()
  return lower.includes("stylesheet") || lower.includes("css") || lower.includes("theme") || lower.includes("tailwind")
}

function formatTextInputs(textInputs: WorkflowTextInput[]): string {
  if (!textInputs || textInputs.length === 0) return ""

  let formatted = "\n\n=== PROVIDED INPUTS ===\n\n"

  textInputs.forEach((input, index) => {
    const label = input.label || `Input ${index + 1}`
    const language = input.language ? ` (${input.language})` : ""

    formatted += `[${label}${language}]:\n\`\`\`\n${input.content}\n\`\`\`\n\n`
  })

  formatted += "=== END INPUTS ===\n\n"
  return formatted
}

function _getLanguageSystemPrompt(prompt: string): string | null {
  const lower = prompt.toLowerCase()
  for (const [language, systemPrompt] of Object.entries(LANGUAGE_SYSTEM_PROMPTS)) {
    if (lower.includes(language)) {
      return systemPrompt
    }
  }
  return null
}

export async function POST(request: Request) {
  const rateLimit = await checkRateLimit()

  if (!rateLimit.success) {
    // Handle configuration errors
    if ("error" in rateLimit) {
      console.error("[generate-image] Rate limit configuration error:", rateLimit.error)
      return NextResponse.json(
        {
          error: "Service unavailable",
          message: rateLimit.error,
        },
        { status: 503 },
      )
    }

    // At this point, rateLimit must be RateLimitResult (has reset property)
    // Type assertion needed because TypeScript doesn't narrow union types properly after return
    const rateLimitResult = rateLimit as { success: false; limit: number; remaining: number; reset: number; limitType: "user" | "global" }

    // Handle rate limit exceeded
    const resetTime = new Date(rateLimitResult.reset).toLocaleTimeString()
    const message =
      rateLimitResult.limitType === "user"
        ? `You have reached the limit of ${USER_LIMIT} generations per hour. Please try again at ${resetTime}.`
        : `The service has reached its global limit of ${GLOBAL_LIMIT} generations per hour. Please try again at ${resetTime}.`

    return NextResponse.json(
      {
        error: "Rate limit exceeded",
        message,
        reset: rateLimitResult.reset,
        limitType: rateLimitResult.limitType,
      },
      { status: 429 },
    )
  }

  try {
    const body = await request.json()
    const { prompt, model = "google/gemini-3-pro-image" } = body

    const targetLanguage = body.targetLanguage as string | undefined

    let inputImages: WorkflowImage[] = []
    if (body.images && Array.isArray(body.images)) {
      inputImages = body.images.map((img: string | WorkflowImage) =>
        typeof img === "string" ? { url: img, mediaType: "image/png" } : img,
      )
    }

    let textInputs: WorkflowTextInput[] = []
    if (body.textInputs && Array.isArray(body.textInputs)) {
      textInputs = body.textInputs
    }

    const modelType = getModelType(model)
    let outputImage: WorkflowImage | undefined
    let text = ""
    let structuredOutput: object | null = null

    if (modelType === "GEMINI_IMAGE") {
      const messageContent: Array<
        { type: "image"; image: URL | string; mediaType?: string } | { type: "text"; text: string }
      > = []

      inputImages.forEach((img) => messageContent.push(toImagePart(img)))

      const imageCount = inputImages.length
      const hasTextInputs = textInputs.length > 0
      let enhancedPrompt = prompt

      // Add text inputs context
      if (hasTextInputs) {
        enhancedPrompt = formatTextInputs(textInputs) + prompt
      }

      if (imageCount > 0) {
        enhancedPrompt = `I have provided ${imageCount} reference image${imageCount > 1 ? "s" : ""} above.

IMPORTANT: You MUST analyze these reference images and incorporate their design elements into your output.

${imageCount >= 2 ? `Reference Image 1 and Reference Image 2 show different design styles. Your task is to CREATE A NEW IMAGE that BLENDS BOTH STYLES together - taking colors, typography, layout patterns, and visual elements from BOTH references.` : ""}

${hasTextInputs ? "\nAdditionally, you have text/code inputs provided above that you should reference and iterate on.\n" : ""}

User request: ${prompt}

Remember: The output image MUST show clear visual influence from the reference image${imageCount > 1 ? "s" : ""} provided. Do not generate a generic image.`
      }

      messageContent.push({ type: "text", text: enhancedPrompt })

      const result = await generateText({
        model,
        system: IMAGE_GENERATION_SYSTEM_PROMPT,
        messages: [{ role: "user", content: messageContent }],
      })

      text = result.text || ""

      if (result.files && result.files.length > 0) {
        for (const file of result.files) {
          if (file.mediaType?.startsWith("image/") && file.uint8Array) {
            const base64 = uint8ToBase64(file.uint8Array)
            outputImage = { url: `data:${file.mediaType};base64,${base64}`, mediaType: file.mediaType }
            break
          }
        }
      }
    } else if (modelType === "IMAGE_ONLY") {
      const result = await experimental_generateImage({
        model,
        prompt: `${prompt}\n\nHigh quality, professional, sharp details, balanced composition.`,
        aspectRatio: "16:9",
      })

      if (result.images && result.images.length > 0) {
        const img = result.images[0]
        outputImage = {
          url: `data:${img.mediaType || "image/png"};base64,${img.base64}`,
          mediaType: img.mediaType || "image/png",
        }
      }
    } else if (modelType === "VISION_TEXT" || modelType === "TEXT_ONLY" || modelType === "UNKNOWN") {
      const messageContent: Array<
        { type: "image"; image: URL | string; mediaType?: string } | { type: "text"; text: string }
      > = []

      // Add images for vision models
      if (modelType === "VISION_TEXT") {
        for (const img of inputImages) {
          messageContent.push(toImagePart(img))
        }
      }

      // Prepend text inputs if available
      let finalPrompt = prompt
      if (textInputs.length > 0) {
        finalPrompt = formatTextInputs(textInputs) + prompt
      }

      messageContent.push({ type: "text", text: finalPrompt })

      // Determine which schema to use based on targetLanguage
      if (isStylesheetRequest(prompt) && !targetLanguage) {
        const result = await generateObject({
          model,
          system: TAILWIND_THEME_SYSTEM_PROMPT,
          schema: tailwindThemeSchema,
          ...(modelType === "TEXT_ONLY"
            ? { prompt: `Based on this design description, generate a Tailwind v4 theme:\n\n${finalPrompt}` }
            : { messages: [{ role: "user" as const, content: messageContent }] }),
        })
        structuredOutput = result.object
        text = themeToCss(result.object)
      } else if (targetLanguage === "json") {
        const result = await generateObject({
          model,
          system: LANGUAGE_SYSTEM_PROMPTS.json,
          schema: jsonOutputSchema,
          ...(modelType === "TEXT_ONLY"
            ? { prompt: finalPrompt }
            : { messages: [{ role: "user" as const, content: messageContent }] }),
        })
        structuredOutput = result.object
        text = JSON.stringify(result.object.data, null, 2)
      } else if (targetLanguage) {
        const result = await generateObject({
          model,
          system: LANGUAGE_SYSTEM_PROMPTS[targetLanguage] || LANGUAGE_SYSTEM_PROMPTS.typescript,
          schema: genericCodeSchema,
          ...(modelType === "TEXT_ONLY"
            ? { prompt: finalPrompt }
            : { messages: [{ role: "user" as const, content: messageContent }] }),
        })
        structuredOutput = result.object
        text = result.object.code
      } else {
        const result = await generateText({
          model,
          messages: modelType === "TEXT_ONLY" ? undefined : [{ role: "user", content: messageContent }],
          prompt: modelType === "TEXT_ONLY" ? finalPrompt : undefined,
        })
        text = result.text || ""
      }
    }

    return NextResponse.json({ success: true, outputImage, text, structuredOutput, remaining: rateLimit.remaining })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Generation failed"
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
