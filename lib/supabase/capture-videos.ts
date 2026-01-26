import { createServerClient } from './server'
import { createLogger } from '@/lib/logger'
import { isValidUUID } from '@/lib/utils'

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
  // Validate UUIDs to prevent path traversal
  if (!isValidUUID(userId)) {
    logger.warn('Invalid userId format in uploadVideoServer', { userId })
    return null
  }
  if (!isValidUUID(captureId)) {
    logger.warn('Invalid captureId format in uploadVideoServer', { captureId })
    return null
  }

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
      filePath,
      contentType,
      dataSize: data.length,
      error: error.message,
      errorDetails: JSON.stringify(error),
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
  // Validate UUIDs to prevent path traversal
  if (!isValidUUID(userId)) {
    logger.warn('Invalid userId format in deleteVideoServer', { userId })
    return false
  }
  if (!isValidUUID(captureId)) {
    logger.warn('Invalid captureId format in deleteVideoServer', { captureId })
    return false
  }
  // Validate filename to prevent path traversal (alphanumeric, dots, hyphens, underscores only)
  if (!filename || !/^[a-zA-Z0-9._-]+$/.test(filename)) {
    logger.warn('Invalid filename format in deleteVideoServer', { filename })
    return false
  }

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
  // Validate UUIDs to prevent path traversal - return empty string for invalid IDs
  if (!isValidUUID(userId) || !isValidUUID(captureId)) {
    logger.warn('Invalid UUID format in getVideoPublicUrl', { userId, captureId })
    return ''
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  return `${supabaseUrl}/storage/v1/object/public/${BUCKET_NAME}/${userId}/${captureId}/${filename}`
}
