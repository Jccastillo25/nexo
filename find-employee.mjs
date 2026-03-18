import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const env = fs.readFileSync('.env.local', 'utf8')
const envMap = Object.fromEntries(env.split('\n').filter(l => l.includes('=')).map(l => l.split('=')))

const supabaseUrl = envMap.NEXT_PUBLIC_SUPABASE_URL?.trim()
const supabaseKey = envMap.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() 

const supabase = createClient(supabaseUrl, supabaseKey)

async function run() {
  console.log('--- Searching for Armando Guido ---')
  
  const { data: employees, error } = await supabase
    .from('employees')
    .select('id, first_name, last_name, employee_code, branch_id, is_active')
    .ilike('first_name', '%Armando%')
    .ilike('last_name', '%Guido%')

  if (error) {
    console.error('Error:', error.message)
    return
  }

  if (!employees || employees.length === 0) {
    console.log('Employee not found.')
    return
  }

  for (const emp of employees) {
    console.log(`Found: ${emp.first_name} ${emp.last_name} (ID: ${emp.id})`)
    console.log(`  employee_code: ${emp.employee_code}`)
    console.log(`  branch_id: ${emp.branch_id}`)
    console.log(`  is_active: ${emp.is_active}`)

    const { data: pins, error: pError } = await supabase
      .from('employee_pins')
      .select('pin, is_active')
      .eq('employee_id', emp.id)
      .eq('is_active', true)

    if (pError) {
      console.error('  Error fetching pins:', pError.message)
    } else {
      console.log('  Active pins in employee_pins:', pins.map(p => p.pin).join(', '))
    }
    
    // Check branch
    const { data: branch } = await supabase
        .from('branches')
        .select('name')
        .eq('id', emp.branch_id)
        .single()
    console.log(`  Branch Name: ${branch?.name}`)
  }
}

run()
