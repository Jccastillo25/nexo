import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const env = fs.readFileSync('.env.local', 'utf8')
const envMap = Object.fromEntries(env.split('\n').filter(l => l.includes('=')).map(l => l.split('=')))

const supabase = createClient(
  envMap.NEXT_PUBLIC_SUPABASE_URL?.trim(),
  envMap.SUPABASE_SERVICE_ROLE_KEY?.trim()
)

async function run() {
  const { data, error } = await supabase.from('shifts').select('id, name, days_of_week').limit(1)
  if (error) {
    console.error('Error fetching shifts:', error.message)
  } else {
    console.log('Shifts:', JSON.stringify(data[0], null, 2))
    if (data[0]) {
      const dow = data[0].days_of_week
      console.log('Type of days_of_week:', Array.isArray(dow) ? 'Array' : typeof dow)
      console.log('Does it include 1?', dow?.includes ? dow.includes(1) : 'No includes method')
    }
  }
}

run()
