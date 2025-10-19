-- Add OCR results and blockchain hash columns to files table
ALTER TABLE public.files
ADD COLUMN IF NOT EXISTS ocr_text TEXT,
ADD COLUMN IF NOT EXISTS file_hash TEXT,
ADD COLUMN IF NOT EXISTS verified_at TIMESTAMP WITH TIME ZONE;

-- Create blockchain_verifications table for audit trail
CREATE TABLE IF NOT EXISTS public.blockchain_verifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  file_id UUID NOT NULL REFERENCES public.files(id) ON DELETE CASCADE,
  file_hash TEXT NOT NULL,
  verification_hash TEXT NOT NULL,
  verified_by UUID REFERENCES auth.users(id),
  verified_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  blockchain_tx_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Enable RLS on blockchain_verifications
ALTER TABLE public.blockchain_verifications ENABLE ROW LEVEL SECURITY;

-- RLS policies for blockchain_verifications
CREATE POLICY "Users can view their own verifications"
ON public.blockchain_verifications FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.files
    WHERE files.id = blockchain_verifications.file_id
    AND files.user_id = auth.uid()
  )
);

CREATE POLICY "Users can create verifications for their files"
ON public.blockchain_verifications FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.files
    WHERE files.id = blockchain_verifications.file_id
    AND files.user_id = auth.uid()
  )
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_blockchain_verifications_file_id 
ON public.blockchain_verifications(file_id);

CREATE INDEX IF NOT EXISTS idx_files_hash 
ON public.files(file_hash);