import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://ofeuzkwjhmfsazqfyutu.supabase.co';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_u8VWBbppU3GKYjCQBSPX5w_yv33zDQ1';

const supabase = createClient(supabaseUrl, supabaseKey)

async function run() {
  const { data: companies, error: e1 } = await supabase.from('companies').select('*').limit(1)
  console.log('Companies First Row:', companies, 'Error:', e1?.message)

  const { data: pins, error: e2 } = await supabase.from('employee_pins').select('*').limit(1)
  console.log('Employee Pins First Row:', pins, 'Error:', e2?.message)
}

run()
