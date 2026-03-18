import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const env = fs.readFileSync('.env.local', 'utf8')
const envMap = Object.fromEntries(env.split('\n').filter(l => l.includes('=')).map(l => l.split('=')))

const supabaseUrl = envMap.NEXT_PUBLIC_SUPABASE_URL?.trim()
const supabaseKey = envMap.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY?.trim() || envMap.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() 

const supabase = createClient(supabaseUrl, supabaseKey)

async function run() {
  console.log('--- Debugging Armando ---')
  
  const { data: employees, error } = await supabase
    .from('employees')
    .select('id, first_name, last_name, employee_code, branch_id, is_active')
    .or('first_name.ilike.%Armando%,last_name.ilike.%Armando%')

  if (error) {
     const { data: allEmp } = await supabase.from('employees').select('id, first_name, last_name, employee_code')
     console.log('All employees:', allEmp)
     return
  }

  if (!employees || employees.length === 0) {
    console.log('No employee found with name Armando.')
    return
  }

  for (const emp of employees) {
    console.log(`Employee: ${emp.first_name} ${emp.last_name} (ID: ${emp.id})`)
    console.log(`  employee_code: ${emp.employee_code}`)
    
    const { data: pins } = await supabase
      .from('employee_pins')
      .select('pin, is_active')
      .eq('employee_id', emp.id)
    
    console.log('  Pins in employee_pins:', pins)

    const { data: branch } = await supabase
      .from('branches')
      .select('id, name')
      .eq('id', emp.branch_id)
      .single()
    console.log(`  Branch: ${branch?.name} (${branch?.id})`)
  }
}

run()
