import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || '';

const adminClient = createClient(supabaseUrl, supabaseKey);

async function check() {
  console.log('--- time_records last 5 ---');
  const { data: records, error } = await adminClient.from('time_records').select('*').order('created_at', { ascending: false }).limit(5);
  console.log(records);
  if (error) console.error(error);
}
check();
