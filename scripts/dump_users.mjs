import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const SUPABASE_URL = 'https://ofeuzkwjhmfsazqfyutu.supabase.co'
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9mZXV6a3dqaG1mc2F6cWZ5dXR1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzAzMDIwOSwiZXhwIjoyMDg4NjA2MjA5fQ.YSwvkWvgglrl3J1KYdCYpZtrEe7VXJIFplxMfM479TM'

const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

async function run() {
  const { data: { users }, error } = await supabase.auth.admin.listUsers()
  if (error) {
    console.error(error)
    return
  }
  
  fs.writeFileSync('scripts/users.json', JSON.stringify(users.map(u => ({ id: u.id, email: u.email })), null, 2))
  console.log('Saved users list')
}

run()
