-- Create storage bucket for workflow images
INSERT INTO storage.buckets (id, name, public)
VALUES ('workflow-images', 'workflow-images', true)
ON CONFLICT (id) DO NOTHING;

-- Allow public access to read images
CREATE POLICY "Public read access for workflow images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'workflow-images');

-- Allow anon users to upload images
CREATE POLICY "Allow anon upload for workflow images"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'workflow-images');

-- Allow anon users to update their images
CREATE POLICY "Allow anon update for workflow images"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'workflow-images');

-- Allow anon users to delete their images
CREATE POLICY "Allow anon delete for workflow images"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'workflow-images');
