import { createClient } from "./client"
import { createServerClient } from "./server"
import { createLogger } from "@/lib/logger"

const logger = createLogger('storage')

// Cache control duration in seconds (1 hour)
const CACHE_CONTROL_SECONDS = "3600"

// Storage bucket names
const STORAGE_BUCKET = "workflow-images"
const SCREENSHOT_BUCKET = "animation-screenshots"

// Maximum allowed base64 image size (10MB decoded)
// This prevents memory exhaustion from malicious or oversized uploads
const MAX_BASE64_SIZE_BYTES = 10 * 1024 * 1024

// Seed image paths relative to storage bucket
const SEED_IMAGE_PATHS = {
  hero: "seed/seed-hero.png",
  integratedBio: "seed/integrated-bio.png",
  combinedOutput: "seed/combined-output.png",
} as const

/**
 * Gets the Supabase URL with validation.
 * Throws an error if the URL is not configured.
 */
function getSupabaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!url) {
    logger.error('NEXT_PUBLIC_SUPABASE_URL is not configured')
    return ""
  }
  return url
}

/**
 * Constructs a public storage URL for a given path.
 */
function getPublicStorageUrl(path: string): string {
  const baseUrl = getSupabaseUrl()
  if (!baseUrl) return ""
  return `${baseUrl}/storage/v1/object/public/${STORAGE_BUCKET}/${path}`
}

async function uploadImage(file: File | Blob, sessionId: string, filename?: string): Promise<string | null> {
  const supabase = createClient()

  const fileExt = file instanceof File ? file.name.split(".").pop() : "png"
  const fileName = filename || `${sessionId}/${Date.now()}.${fileExt}`

  const { data, error } = await supabase.storage.from(STORAGE_BUCKET).upload(fileName, file, {
    cacheControl: CACHE_CONTROL_SECONDS,
    upsert: true,
  })

  if (error) {
    logger.error('Failed to upload', {
      error: error.message,
      fileName,
    })
    return null
  }

  const { data: urlData } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(data.path)
  return urlData.publicUrl
}

export async function uploadBase64Image(base64Data: string, sessionId: string): Promise<string | null> {
  try {
    // SECURITY: Validate input length BEFORE processing to prevent memory exhaustion
    // Base64 encoding increases size by ~33%, so we check against that ratio
    const estimatedDecodedSize = Math.ceil(base64Data.length * 0.75)
    if (estimatedDecodedSize > MAX_BASE64_SIZE_BYTES) {
      logger.error('Image too large', {
        estimatedSizeMB: Math.round(estimatedDecodedSize / 1024 / 1024 * 10) / 10,
        maxSizeMB: MAX_BASE64_SIZE_BYTES / 1024 / 1024,
        sessionId,
      })
      return null
    }

    // Remove data URL prefix
    const base64 = base64Data.replace(/^data:image\/\w+;base64,/, "")

    // Sanitize: remove whitespace that might cause atob() to fail
    const cleanBase64 = base64.replace(/\s+/g, "")

    // Decode base64
    const byteCharacters = atob(cleanBase64)

    // SECURITY: Verify actual decoded size doesn't exceed limit
    if (byteCharacters.length > MAX_BASE64_SIZE_BYTES) {
      logger.error('Decoded image exceeds size limit', {
        actualSizeMB: Math.round(byteCharacters.length / 1024 / 1024 * 10) / 10,
        maxSizeMB: MAX_BASE64_SIZE_BYTES / 1024 / 1024,
        sessionId,
      })
      return null
    }

    const byteNumbers = new Array(byteCharacters.length)
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i)
    }
    const byteArray = new Uint8Array(byteNumbers)
    const blob = new Blob([byteArray], { type: "image/png" })

    return uploadImage(blob, sessionId)
  } catch (error) {
    logger.error('Failed to process base64 data', {
      error: error instanceof Error ? error.message : String(error),
      dataLength: base64Data.length,
    })
    return null
  }
}

export function getSeedImageUrls(): { seedHeroUrl: string; integratedBioUrl: string; combinedOutputUrl: string } {
  return {
    seedHeroUrl: getPublicStorageUrl(SEED_IMAGE_PATHS.hero),
    integratedBioUrl: getPublicStorageUrl(SEED_IMAGE_PATHS.integratedBio),
    combinedOutputUrl: getPublicStorageUrl(SEED_IMAGE_PATHS.combinedOutput),
  }
}

// Animation screenshot utilities

/**
 * Upload a screenshot buffer to Supabase Storage.
 * Uses server client to bypass RLS (for API route usage).
 * Returns the public URL of the uploaded file.
 */
export async function uploadScreenshotServer(
  userId: string,
  captureId: string,
  buffer: Buffer,
  type: "before" | "after",
): Promise<string | null> {
  const supabase = createServerClient()

  // Path format: userId/captureId-type.jpg
  const path = `${userId}/${captureId}-${type}.jpg`

  const { error } = await supabase.storage
    .from(SCREENSHOT_BUCKET)
    .upload(path, buffer, {
      contentType: "image/jpeg",
      cacheControl: CACHE_CONTROL_SECONDS,
      upsert: true,
    })

  if (error) {
    logger.error('Failed to upload', {
      error: error.message,
      path,
    })
    return null
  }

  // Get the public URL
  const { data } = supabase.storage
    .from(SCREENSHOT_BUCKET)
    .getPublicUrl(path)

  return data.publicUrl
}

/**
 * Delete screenshots for a capture.
 */
export async function deleteScreenshotsServer(
  userId: string,
  captureId: string,
): Promise<boolean> {
  const supabase = createServerClient()

  const paths = [
    `${userId}/${captureId}-before.jpg`,
    `${userId}/${captureId}-after.jpg`,
  ]

  const { error } = await supabase.storage
    .from(SCREENSHOT_BUCKET)
    .remove(paths)

  if (error) {
    logger.error('Failed to delete', {
      error: error.message,
      captureId,
    })
    return false
  }

  return true
}
