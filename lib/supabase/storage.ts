import { createClient } from "./client"

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || ""
const SEED_HERO_URL = `${SUPABASE_URL}/storage/v1/object/public/workflow-images/seed/seed-hero.png`
const INTEGRATED_BIO_URL = `${SUPABASE_URL}/storage/v1/object/public/workflow-images/seed/integrated-bio.png`
const COMBINED_OUTPUT_URL = `${SUPABASE_URL}/storage/v1/object/public/workflow-images/seed/combined-output.png`

async function uploadImage(file: File | Blob, sessionId: string, filename?: string): Promise<string | null> {
  const supabase = createClient()

  const fileExt = file instanceof File ? file.name.split(".").pop() : "png"
  const fileName = filename || `${sessionId}/${Date.now()}.${fileExt}`

  const { data, error } = await supabase.storage.from("workflow-images").upload(fileName, file, {
    cacheControl: "3600",
    upsert: true,
  })

  if (error) {
    return null
  }

  const { data: urlData } = supabase.storage.from("workflow-images").getPublicUrl(data.path)
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
  return { seedHeroUrl: SEED_HERO_URL, integratedBioUrl: INTEGRATED_BIO_URL, combinedOutputUrl: COMBINED_OUTPUT_URL }
}
