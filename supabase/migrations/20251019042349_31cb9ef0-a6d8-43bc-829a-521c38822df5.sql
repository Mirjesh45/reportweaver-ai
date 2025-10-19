-- Add file_id column to messages table to support file attachments
ALTER TABLE public.messages 
ADD COLUMN file_id UUID REFERENCES public.files(id) ON DELETE CASCADE;