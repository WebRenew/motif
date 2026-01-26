/**
 * Storage helpers for animation capture frames
 *
 * Stores individual frames instead of stitched strips.
 * Each frame is stored as: {userId}/{captureId}/frame-{index}.jpg
 */

import { createClient } from '@supabase/supabase-js'
import { createLogger } from '@/lib/logger'

const log = createLogger('capture-frames-storage')

const BUCKET_NAME = 'capture-frames'

/**
 * Get server-side Supabase client with service role
 */
function getServiceClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    log.error('Missing Supabase config for frame storage')
    return null
  }

  return createClient(supabaseUrl, serviceRoleKey)
}

/**
 * Upload a single frame to storage
 *
 * @param userId - User ID for namespacing
 * @param captureId - Capture session ID
 * @param frameIndex - Frame number (0-based)
 * @param frameBuffer - JPEG image buffer
 * @returns Public URL of uploaded frame, or null on failure
 */
export async function uploadFrameServer(
  userId: string,
  captureId: string,
  frameIndex: number,
  frameBuffer: Buffer
): Promise<string | null> {
  const supabase = getServiceClient()
  if (!supabase) return null

  const fileName = `${userId}/${captureId}/frame-${frameIndex.toString().padStart(2, '0')}.jpg`

  try {
    const { error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(fileName, frameBuffer, {
        contentType: 'image/jpeg',
        cacheControl: '3600',
        upsert: true,
      })

    if (error) {
      log.error('Failed to upload frame', {
        fileName,
        error: error.message,
      })
      return null
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(fileName)

    return publicUrl
  } catch (error) {
    log.error('Frame upload error', {
      fileName,
      error: error instanceof Error ? error.message : String(error),
    })
    return null
  }
}

/**
 * Delete all frames for a capture session
 *
 * @param userId - User ID
 * @param captureId - Capture session ID
 */
export async function deleteFramesServer(
  userId: string,
  captureId: string
): Promise<boolean> {
  const supabase = getServiceClient()
  if (!supabase) return false

  try {
    const prefix = `${userId}/${captureId}/`

    // List all files in the capture folder
    const { data: files, error: listError } = await supabase.storage
      .from(BUCKET_NAME)
      .list(`${userId}/${captureId}`)

    if (listError) {
      log.error('Failed to list frames for deletion', { prefix, error: listError.message })
      return false
    }

    if (!files || files.length === 0) {
      return true // Nothing to delete
    }

    // Delete all files
    const filePaths = files.map(f => `${prefix}${f.name}`)
    const { error: deleteError } = await supabase.storage
      .from(BUCKET_NAME)
      .remove(filePaths)

    if (deleteError) {
      log.error('Failed to delete frames', { prefix, error: deleteError.message })
      return false
    }

    log.info('Frames deleted', { prefix, count: files.length })
    return true
  } catch (error) {
    log.error('Frame deletion error', {
      error: error instanceof Error ? error.message : String(error),
    })
    return false
  }
}
