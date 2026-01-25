import { createServerClient } from './server'
import { createLogger } from '@/lib/logger'

const logger = createLogger('capture-videos')

const BUCKET_NAME = 'capture-videos'

/**
 * Upload a video/image capture to Supabase Storage (server-side)
 * Uses service role key to bypass RLS
 */
export async function uploadVideoServer(
  userId: string,
  captureId: string,
  data: Buffer | Uint8Array,
  filename: string
): Promise<string | null> {
  const supabase = createServerClient()
  
  // Determine content type from filename
  const ext = filename.split('.').pop()?.toLowerCase()
  let contentType = 'video/mp4'
  if (ext === 'webm') contentType = 'video/webm'
  else if (ext === 'jpg' || ext === 'jpeg') contentType = 'image/jpeg'
  else if (ext === 'png') contentType = 'image/png'

  const filePath = `${userId}/${captureId}/${filename}`

  const { error } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(filePath, data, {
      contentType,
      upsert: true,
    })

  if (error) {
    logger.error('Upload failed', {
      userId,
      captureId,
      filename,
      error: error.message,
    })
    return null
  }

  // Get public URL
  const { data: urlData } = supabase.storage
    .from(BUCKET_NAME)
    .getPublicUrl(filePath)

  return urlData.publicUrl
}

/**
 * Delete a capture video from storage (server-side)
 */
export async function deleteVideoServer(
  userId: string,
  captureId: string,
  filename: string
): Promise<boolean> {
  const supabase = createServerClient()
  const filePath = `${userId}/${captureId}/${filename}`

  const { error } = await supabase.storage
    .from(BUCKET_NAME)
    .remove([filePath])

  if (error) {
    logger.error('Delete failed', {
      filePath,
      error: error.message,
    })
    return false
  }

  return true
}

/**
 * Get public URL for a capture video
 */
export function getVideoPublicUrl(userId: string, captureId: string, filename: string): string {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  return `${supabaseUrl}/storage/v1/object/public/${BUCKET_NAME}/${userId}/${captureId}/${filename}`
}
