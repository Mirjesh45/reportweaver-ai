-- Make reports bucket public for easy access
UPDATE storage.buckets SET public = true WHERE id = 'reports';

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their own reports" ON storage.objects;
DROP POLICY IF EXISTS "Service role can insert reports" ON storage.objects;

-- Create policy to allow users to view reports from their own chats
CREATE POLICY "Users can view their own reports"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'reports' AND
  (storage.foldername(name))[1]::uuid IN (
    SELECT chats.id FROM chats
    JOIN sessions ON sessions.id = chats.session_id
    WHERE sessions.user_id = auth.uid()
  )
);

-- Create policy to allow service role to insert reports
CREATE POLICY "Service role can insert reports"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'reports');