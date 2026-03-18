import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const env = fs.readFileSync('.env.local', 'utf8')
const envMap = Object.fromEntries(env.split('\n').filter(l => l.includes('=')).map(l => l.split('=')))

const supabaseUrl = envMap.NEXT_PUBLIC_SUPABASE_URL?.trim()
const supabaseKey = envMap.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() 

const supabase = createClient(supabaseUrl, supabaseKey)

async function run() {
  console.log('--- Fetching kiosk_clock_event definition ---')
  
  const { data, error } = await supabase.rpc('execute_sql', {
    sql: `
      SELECT routine_definition 
      FROM information_schema.routines 
      WHERE routine_name = 'kiosk_clock_event';
    `
  })

  if (error) {
    console.error('Error:', error.message)
    return
  }

  console.log('Result:', JSON.stringify(data, null, 2))
}

run()
