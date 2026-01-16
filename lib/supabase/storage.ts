import { createClient } from "./client"

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || ""
const SEED_HERO_URL = `${SUPABASE_URL}/storage/v1/object/public/workflow-images/seed/seed-hero.png`
const INTEGRATED_BIO_URL = `${SUPABASE_URL}/storage/v1/object/public/workflow-images/seed/integrated-bio.png`
const COMBINED_OUTPUT_URL = `${SUPABASE_URL}/storage/v1/object/public/workflow-images/seed/combined-output.png`

export async function uploadImage(file: File | Blob, sessionId: string, filename?: string): Promise<string | null> {
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
  const base64 = base64Data.replace(/^data:image\/\w+;base64,/, "")
  const byteCharacters = atob(base64)
  const byteNumbers = new Array(byteCharacters.length)
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i)
  }
  const byteArray = new Uint8Array(byteNumbers)
  const blob = new Blob([byteArray], { type: "image/png" })

  return uploadImage(blob, sessionId)
}

export function getImagePublicUrl(path: string): string {
  const supabase = createClient()
  const { data } = supabase.storage.from("workflow-images").getPublicUrl(path)
  return data.publicUrl
}

export async function initializeSeedImages(): Promise<{
  seedHeroUrl: string | null
  integratedBioUrl: string | null
  combinedOutputUrl: string | null
}> {
  const supabase = createClient()

  const { data: existingFiles } = await supabase.storage.from("workflow-images").list("seed", { limit: 10 })

  const seedHeroExists = existingFiles?.some((f) => f.name === "seed-hero.png")
  const integratedBioExists = existingFiles?.some((f) => f.name === "integrated-bio.png")
  const combinedOutputExists = existingFiles?.some((f) => f.name === "combined-output.png")

  if (seedHeroExists && integratedBioExists && combinedOutputExists) {
    return { seedHeroUrl: SEED_HERO_URL, integratedBioUrl: INTEGRATED_BIO_URL, combinedOutputUrl: COMBINED_OUTPUT_URL }
  }

  const uploads: Promise<void>[] = []

  if (!seedHeroExists) {
    uploads.push(
      fetch("/placeholders/seed-hero.png")
        .then((r) => r.blob())
        .then((blob) =>
          supabase.storage.from("workflow-images").upload("seed/seed-hero.png", blob, {
            cacheControl: "31536000",
            upsert: true,
          }),
        )
        .then(() => {})
        .catch(() => {}),
    )
  }

  if (!integratedBioExists) {
    uploads.push(
      fetch("/placeholders/integrated-bio.png")
        .then((r) => r.blob())
        .then((blob) =>
          supabase.storage.from("workflow-images").upload("seed/integrated-bio.png", blob, {
            cacheControl: "31536000",
            upsert: true,
          }),
        )
        .then(() => {})
        .catch(() => {}),
    )
  }

  if (!combinedOutputExists) {
    uploads.push(
      fetch("/placeholders/combined-output.png")
        .then((r) => r.blob())
        .then((blob) =>
          supabase.storage.from("workflow-images").upload("seed/combined-output.png", blob, {
            cacheControl: "31536000",
            upsert: true,
          }),
        )
        .then(() => {})
        .catch(() => {}),
    )
  }

  await Promise.all(uploads)

  return { seedHeroUrl: SEED_HERO_URL, integratedBioUrl: INTEGRATED_BIO_URL, combinedOutputUrl: COMBINED_OUTPUT_URL }
}

export function getSeedImageUrls(): { seedHeroUrl: string; integratedBioUrl: string; combinedOutputUrl: string } {
  return { seedHeroUrl: SEED_HERO_URL, integratedBioUrl: INTEGRATED_BIO_URL, combinedOutputUrl: COMBINED_OUTPUT_URL }
}
