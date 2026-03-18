import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const env = fs.readFileSync('.env.local', 'utf8')
const envMap = Object.fromEntries(env.split('\n').filter(l => l.includes('=')).map(l => l.split('=')))

const supabaseUrl = envMap.NEXT_PUBLIC_SUPABASE_URL?.trim()
const supabaseKey = envMap.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() 

const supabase = createClient(supabaseUrl, supabaseKey)

async function run() {
  console.log('--- Listing All Employees ---')
  
  const { data: employees, error } = await supabase
    .from('employees')
    .select('id, first_name, last_name, employee_code, branch_id, is_active')

  if (error) {
    console.error('Error:', error.message)
    return
  }

  for (const emp of employees) {
    console.log(`[${emp.is_active ? 'ACTIVE' : 'INACTIVE'}] ${emp.first_name} ${emp.last_name} (Code: ${emp.employee_code}, ID: ${emp.id})`)
  }
}

run()
