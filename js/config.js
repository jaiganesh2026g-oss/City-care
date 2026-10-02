/**
 * CityCare - Supabase Configuration
 * 
 * Replace SUPABASE_URL and SUPABASE_ANON_KEY with your actual credentials 
 * from your Supabase Project Settings -> API.
 */

const SUPABASE_CONFIG = {
  // Example: 'https://xyzcompany.supabase.co'
  SUPABASE_URL: 'https://qjdcrhroobagoemqckqv.supabase.co',
  
  // Example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFqZGNyaHJvb2JhZ29lbXFja3F2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkzMTU4ODcsImV4cCI6MjEwNDg5MTg4N30.GJGR2rsGKevJ8A0qSDrjGKjZP0cexWujUqEAZcQhYx8',

  // Storage bucket name created in Supabase Dashboard
  STORAGE_BUCKET: 'complaint-images'
};

// Check if valid credentials are provided
function isSupabaseConfigured() {
  return (
    SUPABASE_CONFIG.SUPABASE_URL && 
    SUPABASE_CONFIG.SUPABASE_URL !== 'YOUR_SUPABASE_URL_HERE' &&
    SUPABASE_CONFIG.SUPABASE_ANON_KEY && 
    SUPABASE_CONFIG.SUPABASE_ANON_KEY !== 'YOUR_SUPABASE_ANON_KEY_HERE'
  );
}
