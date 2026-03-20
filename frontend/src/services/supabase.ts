import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://fjiufsyrzoymdhrabnog.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZqaXVmc3lyem95bWRocmFibm9nIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMTYwMDcsImV4cCI6MjA4OTU5MjAwN30.sm4lzrBjPI2YDyVM9yfKmxkFOqA8oRXrirgaqb_HlTQ';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
