-- Create storage bucket for animation capture screenshots
-- This stores before/after screenshots from animation captures

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'animation-screenshots',
  'animation-screenshots',
  true,
  5242880,  -- 5MB max per file
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Allow public read access to screenshots
CREATE POLICY "Public read access for animation screenshots"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'animation-screenshots');

-- Allow authenticated users to upload screenshots
CREATE POLICY "Authenticated users can upload screenshots"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'animation-screenshots'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Allow users to delete their own screenshots
CREATE POLICY "Users can delete own screenshots"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'animation-screenshots'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Service role can manage all screenshots
CREATE POLICY "Service role can manage all screenshots"
  ON storage.objects
  USING (bucket_id = 'animation-screenshots' AND auth.role() = 'service_role');
