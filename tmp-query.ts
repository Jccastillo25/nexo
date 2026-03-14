import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://ofeuzkwjhmfsazqfyutu.supabase.co';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_u8VWBbppU3GKYjCQBSPX5w_yv33zDQ1';

const supabase = createClient(supabaseUrl, supabaseKey)

async function run() {
  const { data, error } = await supabase.rpc('query_policies') // We might not have this, let's just use raw SQL if possible? No we can't do raw SQL via REST. 
}
run()
