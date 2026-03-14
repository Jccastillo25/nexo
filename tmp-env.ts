import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://ofeuzkwjhmfsazqfyutu.supabase.co';
// We need the service role key to query pg_policies or to bypass RLS, but we only have anon and maybe service_role is in .env.local
import * as fs from 'fs';
const envContent = fs.readFileSync('.env.local', 'utf-8');
console.log(envContent);
