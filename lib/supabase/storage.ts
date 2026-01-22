import { createClient } from "./client"

// Cache control duration in seconds (1 hour)
const CACHE_CONTROL_SECONDS = "3600"

// Storage bucket name
const STORAGE_BUCKET = "workflow-images"

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
    // Remove data URL prefix
    const base64 = base64Data.replace(/^data:image\/\w+;base64,/, "")

    // Sanitize: remove whitespace that might cause atob() to fail
    const cleanBase64 = base64.replace(/\s+/g, "")

    // Decode base64
    const byteCharacters = atob(cleanBase64)
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
