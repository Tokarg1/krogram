import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://fjiufsyrzoymdhrabnog.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdWJhc2FzZSIsInJlZiI6ImZqNHVmc3lyem95bWRIcmFibm9nIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDI1MDEyMjMsImV4cCI6MjA1ODA3NzIyM30.sm4lzrBjPl2YDyVM9yfKmxkFOqA8oRXrirgaqb_HITQ';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
