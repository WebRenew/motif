import { NextResponse } from "next/server"
import { generateText, experimental_generateImage, generateObject } from "ai"
import { tailwindThemeSchema, themeToCss } from "@/lib/schemas/tailwind-theme"
import { genericCodeSchema, jsonOutputSchema, multiFileOutputSchema } from "@/lib/schemas/code-output"
import type { WorkflowImage, WorkflowTextInput } from "@/lib/types/workflow"
import { checkRateLimit, USER_LIMIT, GLOBAL_LIMIT } from "@/lib/rate-limit"
import { uploadBase64Image } from "@/lib/supabase/storage"
import { createLogger, generateRequestId, startTimer } from "@/lib/logger"
import { isUserAnonymousServer } from "@/lib/supabase/auth"
import { isValidUUID } from "@/lib/utils"
import { DEFAULT_IMAGE_MODEL } from "@/lib/constants"
import type { CodeLanguage } from "@/lib/types/languages"
import { isValidCodeLanguage } from "@/lib/types/languages"

const logger = createLogger('generate-image')

// Note: Must be a literal value for Next.js segment configuration.
// Keep in sync with API_MAX_DURATION_SECONDS in lib/constants.ts
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

CRITICAL OUTPUT FORMAT: Always generate FULL-WIDTH, BROWSER-SIZED hero sections or website mockups. Your output should:
- Fill the entire canvas as a complete hero/landing section
- Use 16:9 or similar wide aspect ratio composition
- Show a full browser-width layout, NOT cropped components or small UI fragments
- Include proper visual hierarchy across the full canvas width

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
  text: `You are a helpful writing assistant. Generate clear, well-structured plain text content.
- Use natural language appropriate to the context
- Structure content with clear paragraphs when needed
- No code fences, markdown formatting, or special syntax unless explicitly requested
Output ONLY the requested text content.`,

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

  markdown: `You are a technical writer and design expert. Generate well-structured Markdown content that:
- Uses clear heading hierarchy (# ## ###)
- Includes bullet points and numbered lists where appropriate
- Uses **bold** and *italic* for emphasis
- Structures feedback in clear, actionable sections
- Is professional, constructive, and specific
Output ONLY the Markdown content, no code fences or explanations.`,
}

const MULTI_FILE_SYSTEM_PROMPT = `You are an expert full-stack developer. When generating code, you should create MULTIPLE separate files when appropriate:
- Components should have their own file (ComponentName.tsx)
- Styles should be in a separate file (component-name.css or component.module.css)
- Types/interfaces can be in a separate file if complex (types.ts)
- Utilities should be separate (utils.ts)

Generate clean, production-ready code for each file. Each file should be complete and ready to use.
Do NOT combine multiple concerns into a single file when separation would be better.`

/**
 * Detects if a prompt likely requires multiple output files
 */
function shouldGenerateMultipleFiles(prompt: string, targetLanguage?: string): boolean {
  const lower = prompt.toLowerCase()
  
  // Explicit multi-file indicators
  if (lower.includes("with styles") || lower.includes("with css") || lower.includes("and styles")) return true
  if (lower.includes("with types") || lower.includes("and types")) return true
  if (lower.includes("multiple files") || lower.includes("separate files")) return true
  if (lower.includes("component and") || lower.includes("components and")) return true
  
  // Component extraction from designs often needs component + styles
  if (targetLanguage === "tsx" || targetLanguage === "jsx") {
    if (lower.includes("extract") || lower.includes("convert") || lower.includes("recreate")) return true
    if (lower.includes("design") || lower.includes("screenshot") || lower.includes("mockup")) return true
  }
  
  return false
}

function cleanBase64(dataUrl: string): string {
  // Extract base64 data from data URL (format: data:image/png;base64,...)
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/)
  if (!match) {
    throw new Error("Invalid data URL format")
  }

  const [, mediaType, base64Data] = match
  // Remove whitespace, newlines, and other invalid characters from base64
  const cleanedBase64 = base64Data.replace(/\s+/g, '')

  // Validate base64 format (only valid base64 characters)
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(cleanedBase64)) {
    throw new Error("Invalid base64 characters in data URL")
  }

  return `data:${mediaType};base64,${cleanedBase64}`
}

/**
 * Validates and normalizes image URLs for AI model consumption.
 * Handles HTTP(S) URLs, data URLs, and detects invalid formats.
 */
function toImagePart(img: WorkflowImage, index: number): { type: "image"; image: URL | string; mediaType?: string } {
  const { url } = img
  
  // Guard against empty or invalid URLs
  if (!url || typeof url !== "string" || url.trim() === "") {
    throw new Error(`Image ${index + 1} has empty or invalid URL`)
  }

  // Handle HTTP(S) URLs - most common for Supabase storage
  if (url.startsWith("http://") || url.startsWith("https://")) {
    try {
      return { type: "image", image: new URL(url), mediaType: img.mediaType }
    } catch {
      throw new Error(`Image ${index + 1} has malformed HTTP URL: ${url.slice(0, 100)}...`)
    }
  }

  // Handle data URLs (base64 encoded images)
  if (url.startsWith("data:")) {
    try {
      const cleanedUrl = cleanBase64(url)
      return { type: "image", image: cleanedUrl, mediaType: img.mediaType }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Unknown error"
      throw new Error(`Image ${index + 1} has invalid data URL: ${errorMsg}`)
    }
  }

  // Detect relative URLs (likely misconfigured Supabase)
  if (url.startsWith("/")) {
    throw new Error(
      `Image ${index + 1} has relative URL (${url.slice(0, 50)}...). ` +
      `This usually means NEXT_PUBLIC_SUPABASE_URL is not configured. ` +
      `Image URLs must be absolute HTTP(S) URLs or data URLs.`
    )
  }

  // Detect blob URLs (browser-only, shouldn't reach server)
  if (url.startsWith("blob:")) {
    throw new Error(
      `Image ${index + 1} has blob URL which cannot be processed on the server. ` +
      `Please upload the image first or convert to base64.`
    )
  }

  // Unknown format - provide helpful debugging info
  const urlPreview = url.length > 50 ? `${url.slice(0, 50)}...` : url
  throw new Error(
    `Image ${index + 1} has unsupported URL format: "${urlPreview}". ` +
    `Expected HTTP(S) URL or data:image/...;base64,... format.`
  )
}

function uint8ToBase64(u8: Uint8Array): string {
  return Buffer.from(u8).toString("base64")
}

function getModelType(model: string): "GEMINI_IMAGE" | "IMAGE_ONLY" | "VISION_TEXT" | "TEXT_ONLY" | "UNKNOWN" {
  if (GEMINI_IMAGE_MODELS.includes(model)) return "GEMINI_IMAGE"
  if (IMAGE_ONLY_MODELS.includes(model)) return "IMAGE_ONLY"
  if (VISION_TEXT_MODELS.includes(model)) return "VISION_TEXT"
  if (TEXT_ONLY_MODELS.includes(model)) return "TEXT_ONLY"
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

// Allowed models whitelist for validation
const ALLOWED_MODELS = [
  ...GEMINI_IMAGE_MODELS,
  ...IMAGE_ONLY_MODELS,
  ...VISION_TEXT_MODELS,
  ...TEXT_ONLY_MODELS,
]

/**
 * Validates sessionId to prevent path traversal and storage manipulation attacks.
 *
 * SECURITY: This function is critical for preventing:
 * - Path traversal attacks (e.g., "../../../etc/passwd")
 * - Storage namespace pollution
 * - Memory exhaustion from extremely long inputs
 *
 * The returned ID is always prefixed with "user_" to ensure user-provided
 * IDs are isolated from any system-generated storage paths.
 *
 * Only allows alphanumeric characters, hyphens, and underscores.
 */
function validateSessionId(sessionId: string): string {
  // SECURITY: Validate length BEFORE any processing to prevent memory issues
  // from extremely long malicious inputs
  const MAX_INPUT_LENGTH = 256
  const MAX_OUTPUT_LENGTH = 64

  // Handle missing, invalid type, or empty inputs
  if (!sessionId || typeof sessionId !== "string" || sessionId.trim().length === 0) {
    return "user_default"
  }

  // SECURITY: Truncate input BEFORE sanitization to prevent memory exhaustion
  // from processing extremely long strings
  const truncatedInput = sessionId.slice(0, MAX_INPUT_LENGTH)

  // SECURITY: Remove ALL characters that could enable path traversal or injection:
  // - ".." (path traversal)
  // - "/" or "\" (directory separators)
  // - Any non-alphanumeric except hyphens and underscores
  // This regex whitelist approach ensures only safe characters remain
  const sanitized = truncatedInput.replace(/[^a-zA-Z0-9_-]/g, "")

  // SECURITY: Enforce maximum length on sanitized output
  const finalId = sanitized.slice(0, MAX_OUTPUT_LENGTH)

  // SECURITY: Ensure result is never empty - always provide a safe default
  if (finalId.length === 0) {
    return "user_default"
  }

  // SECURITY: Prefix with "user_" to isolate user-provided IDs from system paths
  // This prevents any confusion between user sessions and system storage locations
  return `user_${finalId}`
}

/**
 * Validates model against whitelist to prevent model confusion attacks.
 */
function validateModel(model: string): string {
  if (!model || typeof model !== "string") {
    return DEFAULT_IMAGE_MODEL
  }
  if (ALLOWED_MODELS.includes(model)) {
    return model
  }
  // Don't log user-provided model names in production to prevent information disclosure
  if (process.env.NODE_ENV !== "production") {
    logger.warn('Invalid model requested, using default')
  }
  return DEFAULT_IMAGE_MODEL
}

/**
 * Validates targetLanguage against whitelist.
 */
function validateTargetLanguage(language: unknown): CodeLanguage | undefined {
  if (!language || typeof language !== "string") {
    return undefined
  }
  if (isValidCodeLanguage(language)) {
    return language
  }
  // Don't log user-provided values in production to prevent information disclosure
  if (process.env.NODE_ENV !== "production") {
    logger.warn('Invalid targetLanguage requested')
  }
  return undefined
}

export async function POST(request: Request) {
  const requestId = generateRequestId()
  const timer = startTimer()
  
  const rateLimit = await checkRateLimit()

  if (!rateLimit.success) {
    // Handle configuration errors
    if ("error" in rateLimit) {
      logger.error('Rate limit configuration error', { requestId, error: rateLimit.error })
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
    // Note: Don't format time here - let client format in user's local timezone
    const message =
      rateLimitResult.limitType === "user"
        ? `You have reached the limit of ${USER_LIMIT} generations per hour.`
        : `The service has reached its global limit of ${GLOBAL_LIMIT} generations per hour.`

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

  // Type assertion: at this point rateLimit.success must be true and has remaining property
  const rateLimitSuccess = rateLimit as { success: true; limit: number; remaining: number; reset: number; limitType: "user" | "global" }

  try {
    let body: Record<string, unknown>
    try {
      body = await request.json()
    } catch (parseError) {
      logger.error('Failed to parse request body', {
        requestId,
        error: parseError instanceof Error ? parseError.message : String(parseError),
      })
      return NextResponse.json(
        { success: false, error: "Invalid request: Could not parse JSON body" },
        { status: 400 }
      )
    }

    // Auth check: Require valid userId and block anonymous users
    const userId = (body as { userId?: string }).userId
    if (!userId || typeof userId !== "string") {
      return NextResponse.json(
        { success: false, error: "Authentication required" },
        { status: 401 }
      )
    }

    if (!isValidUUID(userId)) {
      logger.warn('Invalid userId format in generate-image request', { requestId, userId: userId.slice(0, 8) + '...' })
      return NextResponse.json(
        { success: false, error: "Invalid user ID format" },
        { status: 400 }
      )
    }

    // Check if user is anonymous (premium feature - requires authenticated user)
    const isAnonymous = await isUserAnonymousServer(userId)
    if (isAnonymous === null) {
      // User not found
      return NextResponse.json(
        { success: false, error: "User not found" },
        { status: 401 }
      )
    }
    if (isAnonymous) {
      return NextResponse.json(
        { success: false, error: "Sign in required to generate images" },
        { status: 403 }
      )
    }

    const rawModel = (body as { model?: string }).model || "google/gemini-3-pro-image"
    const model = validateModel(rawModel)
    const prompt = (body as { prompt?: string }).prompt || ""

    // Validate prompt is not empty and has reasonable length
    if (!prompt || typeof prompt !== "string" || prompt.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: "Prompt is required" },
        { status: 400 }
      )
    }
    if (prompt.length > 50000) {
      return NextResponse.json(
        { success: false, error: "Prompt exceeds maximum length (50000 characters)" },
        { status: 400 }
      )
    }
    
    // Log request info for debugging (sanitized - no full prompt/images)
    // For images, log URL type (http, data, relative, etc.) without full content
    const imageUrlTypes = Array.isArray(body.images) 
      ? body.images.map((img: string | { url?: string }, i: number) => {
          const url = typeof img === "string" ? img : img?.url
          if (!url || typeof url !== "string") return `[${i}]: invalid (not a string)`
          if (url.startsWith("https://")) return `[${i}]: https (${url.slice(0, 60)}...)`
          if (url.startsWith("http://")) return `[${i}]: http`
          if (url.startsWith("data:image/")) return `[${i}]: data URL (${url.slice(0, 30)}...)`
          if (url.startsWith("data:")) return `[${i}]: data URL (non-image: ${url.slice(0, 30)}...)`
          if (url.startsWith("/")) return `[${i}]: relative path (${url.slice(0, 50)})`
          if (url.startsWith("blob:")) return `[${i}]: blob URL`
          return `[${i}]: unknown (${url.slice(0, 30)}...)`
        })
      : []
    
    logger.info('Request received', {
      requestId,
      model,
      promptLength: typeof prompt === "string" ? prompt.length : 0,
      hasImages: Array.isArray(body.images) && body.images.length > 0,
      imageCount: Array.isArray(body.images) ? body.images.length : 0,
      imageUrlTypes,
      targetLanguage: body.targetLanguage || "none",
    })

    const targetLanguage = validateTargetLanguage(body.targetLanguage)

    let inputImages: WorkflowImage[] = []
    if (body.images && Array.isArray(body.images)) {
      try {
        inputImages = body.images.map((img: string | WorkflowImage, index: number) => {
          const workflowImage = typeof img === "string" ? { url: img, mediaType: "image/png" } : img

          // Validate image data early to provide better error messages
          if (!workflowImage.url || typeof workflowImage.url !== "string") {
            throw new Error(`Image ${index + 1} has invalid or missing URL`)
          }

          // Check if it's a data URL and validate format
          if (workflowImage.url.startsWith("data:")) {
            if (!workflowImage.url.match(/^data:([^;]+);base64,/)) {
              throw new Error(`Image ${index + 1} has malformed data URL (missing or invalid base64 prefix)`)
            }
          }

          // Validate sequenceNumber if present
          if (workflowImage.sequenceNumber !== undefined) {
            if (
              typeof workflowImage.sequenceNumber !== "number" ||
              workflowImage.sequenceNumber < 1 ||
              !Number.isFinite(workflowImage.sequenceNumber)
            ) {
              logger.warn(`Image ${index + 1} has invalid sequenceNumber (${workflowImage.sequenceNumber}), removing it`)
              workflowImage.sequenceNumber = undefined
            }
          }

          return workflowImage
        })
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : "Unknown error"
        logger.error('Image validation failed', {
          requestId,
          error: errorMsg,
          imageCount: body.images.length,
        })
        return NextResponse.json(
          { success: false, error: `Invalid image data: ${errorMsg}` },
          { status: 400 }
        )
      }
    }

    let textInputs: WorkflowTextInput[] = []
    if (body.textInputs !== undefined) {
      // Validate text inputs - reject oversized inputs instead of silent truncation
      const MAX_TEXT_INPUTS = 10
      const MAX_CONTENT_LENGTH = 50000
      const MAX_LABEL_LENGTH = 100
      const MAX_LANGUAGE_LENGTH = 20

      if (!Array.isArray(body.textInputs)) {
        return NextResponse.json(
          { success: false, error: "textInputs must be an array" },
          { status: 400 }
        )
      }

      if (body.textInputs.length > MAX_TEXT_INPUTS) {
        return NextResponse.json(
          { success: false, error: `Too many text inputs (max ${MAX_TEXT_INPUTS})` },
          { status: 400 }
        )
      }

      for (let i = 0; i < body.textInputs.length; i++) {
        const input = body.textInputs[i] as WorkflowTextInput
        if (typeof input.content === "string" && input.content.length > MAX_CONTENT_LENGTH) {
          return NextResponse.json(
            { success: false, error: `Text input ${i + 1} exceeds maximum length (${MAX_CONTENT_LENGTH} chars)` },
            { status: 400 }
          )
        }
        if (typeof input.label === "string" && input.label.length > MAX_LABEL_LENGTH) {
          return NextResponse.json(
            { success: false, error: `Text input ${i + 1} label exceeds maximum length (${MAX_LABEL_LENGTH} chars)` },
            { status: 400 }
          )
        }
        if (typeof input.language === "string" && input.language.length > MAX_LANGUAGE_LENGTH) {
          return NextResponse.json(
            { success: false, error: `Text input ${i + 1} language exceeds maximum length (${MAX_LANGUAGE_LENGTH} chars)` },
            { status: 400 }
          )
        }
      }

      textInputs = body.textInputs.map((input: WorkflowTextInput, index: number) => ({
        content: typeof input.content === "string" ? input.content : "",
        label: typeof input.label === "string" ? input.label : `Input ${index + 1}`,
        language: typeof input.language === "string" ? input.language : undefined,
      }))
    }

    const modelType = getModelType(model)
    let outputImage: WorkflowImage | undefined
    let text = ""
    let structuredOutput: object | null = null

    if (modelType === "GEMINI_IMAGE") {
      const messageContent: Array<
        { type: "image"; image: URL | string; mediaType?: string } | { type: "text"; text: string }
      > = []

      inputImages.forEach((img, idx) => messageContent.push(toImagePart(img, idx)))

      const imageCount = inputImages.length
      const hasTextInputs = textInputs.length > 0
      let enhancedPrompt = prompt

      // Add text inputs context
      if (hasTextInputs) {
        enhancedPrompt = formatTextInputs(textInputs) + prompt
      }

      if (imageCount > 0) {
        // Check for frame strip images (from animation capture)
        const frameStripImages = inputImages.filter(img => img.frameStripInfo)
        const hasFrameStrip = frameStripImages.length > 0
        
        let frameStripContext = ""
        if (hasFrameStrip) {
          const stripInfo = frameStripImages[0].frameStripInfo!
          const includedFrames = stripInfo.totalFrames - stripInfo.excludedFrames.length
          frameStripContext = `

IMPORTANT - FRAME STRIP IMAGE: One of the reference images is a HORIZONTAL FRAME STRIP containing ${stripInfo.totalFrames} animation frames stitched side-by-side (${includedFrames} included, ${stripInfo.excludedFrames.length} excluded).
- This is NOT a single design - it shows an animation sequence over time
- The FIRST (leftmost) frame shows the initial/primary state of the design
- Use the FIRST FRAME as your primary reference for colors, typography, layout, and overall design language
- Do NOT replicate the horizontal strip layout - generate a SINGLE cohesive hero/design based on the first frame's style`
        }

        // Build sequence context if images have sequence numbers
        const hasSequence = inputImages.some(
          img => typeof img.sequenceNumber === "number" &&
                 img.sequenceNumber > 0 &&
                 Number.isFinite(img.sequenceNumber)
        )
        let sequenceContext = ""

        if (hasSequence && imageCount >= 2) {
          const sequenceList = inputImages
            .filter(img =>
              typeof img.sequenceNumber === "number" &&
              img.sequenceNumber > 0 &&
              Number.isFinite(img.sequenceNumber)
            )
            .map(img => `Image ${img.sequenceNumber}`)
            .join(", ")
          sequenceContext = `\n\nTHE IMAGES ARE ORDERED IN A SEQUENCE: ${sequenceList} (from top to bottom). This ordering may represent an animation sequence, progression, or step-by-step process. Consider this sequence when analyzing the images.`
        }

        enhancedPrompt = `I have provided ${imageCount} reference image${imageCount > 1 ? "s" : ""} above.

IMPORTANT: You MUST analyze these reference images and incorporate their design elements into your output.
${frameStripContext}
${imageCount >= 2 && !hasFrameStrip ? `Reference Image 1 and Reference Image 2 show different design styles. Your task is to CREATE A NEW IMAGE that BLENDS BOTH STYLES together - taking colors, typography, layout patterns, and visual elements from BOTH references.` : ""}${sequenceContext}

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
        // Guard against missing base64 data - API should always return it, but be defensive
        if (img?.base64) {
          outputImage = {
            url: `data:${img.mediaType || "image/png"};base64,${img.base64}`,
            mediaType: img.mediaType || "image/png",
          }
        } else {
          logger.warn('Image generation returned result without base64 data', { 
            hasImage: !!img,
            hasBase64: !!img?.base64,
          })
        }
      }
    } else if (modelType === "VISION_TEXT" || modelType === "TEXT_ONLY" || modelType === "UNKNOWN") {
      const messageContent: Array<
        { type: "image"; image: URL | string; mediaType?: string } | { type: "text"; text: string }
      > = []

      // Add images for vision models
      if (modelType === "VISION_TEXT") {
        inputImages.forEach((img, idx) => {
          messageContent.push(toImagePart(img, idx))
        })
      }

      // Prepend text inputs if available
      let finalPrompt = prompt
      if (textInputs.length > 0) {
        finalPrompt = formatTextInputs(textInputs) + prompt
      }

      // Add sequence context if images have sequence numbers
      if (modelType === "VISION_TEXT" && inputImages.length >= 2) {
        const hasSequence = inputImages.some(
          img => typeof img.sequenceNumber === "number" &&
                 img.sequenceNumber > 0 &&
                 Number.isFinite(img.sequenceNumber)
        )
        if (hasSequence) {
          const sequenceList = inputImages
            .filter(img =>
              typeof img.sequenceNumber === "number" &&
              img.sequenceNumber > 0 &&
              Number.isFinite(img.sequenceNumber)
            )
            .map(img => `Image ${img.sequenceNumber}`)
            .join(", ")
          const sequenceContext = `\n\nIMPORTANT: The images provided are ordered in a sequence: ${sequenceList} (from top to bottom). This ordering may represent an animation sequence, progression, timeline, or step-by-step process. Consider this sequence when analyzing the images.\n\n`
          finalPrompt = sequenceContext + finalPrompt
        }
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
      } else if (targetLanguage && shouldGenerateMultipleFiles(prompt, targetLanguage)) {
        // Multi-file generation for complex requests
        const result = await generateObject({
          model,
          system: MULTI_FILE_SYSTEM_PROMPT + "\n\n" + (LANGUAGE_SYSTEM_PROMPTS[targetLanguage] || LANGUAGE_SYSTEM_PROMPTS.typescript),
          schema: multiFileOutputSchema,
          ...(modelType === "TEXT_ONLY"
            ? { prompt: finalPrompt }
            : { messages: [{ role: "user" as const, content: messageContent }] }),
        })
        structuredOutput = result.object
        
        // Primary file content goes to text, full files array is in structuredOutput
        // Guard against empty files array from AI response
        if (result.object.files && result.object.files.length > 0) {
          const primaryFilename = result.object.primaryFile
          const primaryFile = primaryFilename 
            ? result.object.files.find(f => f.filename === primaryFilename)
            : result.object.files[0]
          text = primaryFile?.content || result.object.files[0]?.content || ""
        } else {
          logger.warn('Multi-file generation returned empty files array')
          text = ""
        }
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
          ...(modelType === "TEXT_ONLY"
            ? { prompt: finalPrompt }
            : { messages: [{ role: "user" as const, content: messageContent }] }),
        })
        text = result.text || ""
      }
    }

    // Upload base64 images to Supabase to get public URLs
    // IMPORTANT: If storage fails, we fall back to base64 which can cause large payloads
    let storageWarning: string | undefined
    if (outputImage?.url.startsWith("data:")) {
      const sessionId = validateSessionId((body.sessionId as string) || "default")
      const base64SizeKB = Math.round(outputImage.url.length * 0.75 / 1024) // Approximate decoded size
      try {
        const publicUrl = await uploadBase64Image(outputImage.url, sessionId)
        if (publicUrl) {
          outputImage = { url: publicUrl, mediaType: outputImage.mediaType }
        } else {
          logger.warn('Failed to upload image to Supabase, returning base64', {
            requestId,
            approximateSizeKB: base64SizeKB,
            sessionId,
          })
          storageWarning = "Image storage unavailable - returning embedded image data"
        }
      } catch (uploadError) {
        logger.error('Error uploading image to Supabase', {
          requestId,
          error: uploadError instanceof Error ? uploadError.message : String(uploadError),
          approximateSizeKB: base64SizeKB,
          sessionId,
        })
        storageWarning = "Image storage error - returning embedded image data"
        // Continue with base64 if upload fails
      }
    }

    logger.info('Request completed', {
      requestId,
      durationMs: timer.elapsed(),
      hasOutputImage: !!outputImage,
      textLength: text.length,
    })

    return NextResponse.json({
      success: true,
      outputImage,
      text,
      structuredOutput,
      remaining: rateLimitSuccess.remaining,
      ...(storageWarning && { warning: storageWarning })
    })
  } catch (error) {
    // Log comprehensive error details for debugging
    const errorMessage = error instanceof Error ? error.message : String(error)
    const errorStack = error instanceof Error ? error.stack : undefined
    const errorName = error instanceof Error ? error.name : "UnknownError"
    
    logger.error('Generation failed', {
      requestId,
      durationMs: timer.elapsed(),
      errorName,
      errorMessage,
      errorStack,
    })

    // Provide user-friendly messages for common errors
    let userMessage = "Generation failed"
    let statusCode = 500

    if (errorMessage.includes("Invalid character")) {
      userMessage = "Invalid input: The request contains invalid characters. Please check your prompt and try again."
      logger.error('Invalid character error - likely malformed base64 or special characters in input', { requestId })
    } else if (errorMessage.includes("fetch") || errorMessage.includes("network") || errorMessage.includes("ECONNREFUSED")) {
      userMessage = "Network error: Unable to reach the AI service. Please try again."
      statusCode = 502
    } else if (errorMessage.includes("timeout") || errorMessage.includes("ETIMEDOUT")) {
      userMessage = "Request timed out. Please try again with a simpler prompt."
      statusCode = 504
    } else if (errorMessage.includes("401") || errorMessage.includes("unauthorized") || errorMessage.includes("API key")) {
      userMessage = "Authentication error with AI service. Please contact support."
      statusCode = 502
    } else if (errorMessage.includes("quota") || errorMessage.includes("limit")) {
      userMessage = "AI service quota exceeded. Please try again later."
      statusCode = 429
    } else if (error instanceof SyntaxError) {
      userMessage = "Invalid request format. Please refresh and try again."
      statusCode = 400
    }

    return NextResponse.json(
      { 
        success: false, 
        error: userMessage,
        // Include original error in non-production for debugging
        ...(process.env.NODE_ENV !== "production" && { debugError: errorMessage })
      }, 
      { status: statusCode }
    )
  }
}
