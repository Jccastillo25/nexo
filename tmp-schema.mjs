import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
)

async function run() {
  const { data: companies, error: e1 } = await supabase.from('companies').select('*').limit(1)
  console.log('Companies:', companies, 'Error:', e1?.message)

  const { data: pins, error: e2 } = await supabase.from('employee_pins').select('*').limit(1)
  console.log('Employee Pins:', pins, 'Error:', e2?.message)
}

run()
