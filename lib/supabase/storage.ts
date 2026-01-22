import { createClient } from "./client"

// Cache control duration in seconds (1 hour)
const CACHE_CONTROL_SECONDS = "3600"

// Storage bucket name
const STORAGE_BUCKET = "workflow-images"

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
    console.error("[storage] NEXT_PUBLIC_SUPABASE_URL is not configured")
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
    console.error("[uploadImage] Failed to upload:", {
      error: error.message,
      fileName,
      timestamp: new Date().toISOString(),
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
      console.error("[uploadBase64Image] Image too large:", {
        estimatedSizeMB: Math.round(estimatedDecodedSize / 1024 / 1024 * 10) / 10,
        maxSizeMB: MAX_BASE64_SIZE_BYTES / 1024 / 1024,
        sessionId,
        timestamp: new Date().toISOString(),
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
      console.error("[uploadBase64Image] Decoded image exceeds size limit:", {
        actualSizeMB: Math.round(byteCharacters.length / 1024 / 1024 * 10) / 10,
        maxSizeMB: MAX_BASE64_SIZE_BYTES / 1024 / 1024,
        sessionId,
        timestamp: new Date().toISOString(),
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
    console.error("[uploadBase64Image] Failed to process base64 data:", {
      error: error instanceof Error ? error.message : String(error),
      dataLength: base64Data.length,
      timestamp: new Date().toISOString(),
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
