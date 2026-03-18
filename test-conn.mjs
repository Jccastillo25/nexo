import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const env = fs.readFileSync('.env.local', 'utf8')
const envMap = Object.fromEntries(env.split('\n').filter(l => l.includes('=')).map(l => l.split('=')))

const supabaseUrl = envMap.NEXT_PUBLIC_SUPABASE_URL?.trim()
const supabaseKey = envMap.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim()

console.log('Testing connection to:', supabaseUrl)
const supabase = createClient(supabaseUrl, supabaseKey)

async function run() {
  const { data, error } = await supabase.from('branches').select('id, name').limit(1)
  if (error) {
    console.error('Error fetching branches:', error)
  } else {
    console.log('Successfully fetched branch:', data)
  }
}

run()
