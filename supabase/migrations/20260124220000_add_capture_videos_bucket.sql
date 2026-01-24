-- Create storage bucket for animation capture videos
-- Stores recorded video captures from Browserbase sessions

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'capture-videos',
  'capture-videos',
  true,
  104857600,  -- 100MB max per file (videos can be larger)
  ARRAY['video/mp4', 'video/webm']
)
ON CONFLICT (id) DO NOTHING;

-- Allow public read access to videos
CREATE POLICY "Public read access for capture videos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'capture-videos');

-- Allow authenticated users to upload videos
CREATE POLICY "Authenticated users can upload capture videos"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'capture-videos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Allow users to delete their own videos
CREATE POLICY "Users can delete own capture videos"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'capture-videos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Service role can manage all videos
CREATE POLICY "Service role can manage all capture videos"
  ON storage.objects
  USING (bucket_id = 'capture-videos' AND auth.role() = 'service_role');

-- Add video_url column to animation_captures table
ALTER TABLE animation_captures
ADD COLUMN IF NOT EXISTS video_url TEXT;

-- Add comment for documentation
COMMENT ON COLUMN animation_captures.video_url IS 'URL to the captured video in Supabase storage';
