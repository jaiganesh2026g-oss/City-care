-- Supabase Database Schema for CityCare Civic Issue Reporting Platform

-- 1. Create Complaints Table
CREATE TABLE IF NOT EXISTS public.complaints (
  id TEXT PRIMARY KEY,
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  category TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  location TEXT NOT NULL,
  image_url TEXT,
  priority TEXT DEFAULT 'Medium',
  status TEXT DEFAULT 'Pending',
  admin_remarks TEXT DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 2. Enable Row Level Security (RLS)
ALTER TABLE public.complaints ENABLE ROW LEVEL SECURITY;

-- 3. Create Public Access Policies
-- Allow anyone to read complaints (for tracking and admin listing)
CREATE POLICY "Allow public read access" ON public.complaints
  FOR SELECT USING (true);

-- Allow anyone to submit new complaints
CREATE POLICY "Allow public insert access" ON public.complaints
  FOR INSERT WITH CHECK (true);

-- Allow updates for complaints (for status changes and remarks)
CREATE POLICY "Allow public update access" ON public.complaints
  FOR UPDATE USING (true);

-- Allow deletes for complaints
CREATE POLICY "Allow public delete access" ON public.complaints
  FOR DELETE USING (true);

-- 4. Storage Bucket Setup Instructions
-- In your Supabase Dashboard:
-- Go to Storage -> Create a new public bucket named 'complaint-images'
-- Enable Public access for 'complaint-images' bucket
