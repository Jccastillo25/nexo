import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
)

async function run() {
  const { data, error } = await supabase.from('employees').select('*').limit(1)
  if (error) {
    console.error('Error:', error.message)
  } else {
    console.log('Columns:', Object.keys(data[0] || {}))
  }
}

run()
