import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const env = fs.readFileSync('.env.local', 'utf8')
const envMap = Object.fromEntries(env.split('\n').filter(l => l.includes('=')).map(l => l.split('=')))

const supabaseUrl = envMap.NEXT_PUBLIC_SUPABASE_URL?.trim()
const supabaseKey = envMap.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() 

const supabase = createClient(supabaseUrl, supabaseKey)

async function run() {
  console.log('--- Searching for Branch SUC-01 ---')
  
  const { data: branch, error: bError } = await supabase
    .from('branches')
    .select('id, name, code')
    .ilike('code', 'suc-01')
    .single()

  if (bError || !branch) {
    console.error('Branch SUC-01 not found:', bError?.message)
    return
  }

  console.log(`Branch Found: ${branch.name} (ID: ${branch.id}, Code: ${branch.code})`)

  console.log('--- Listing Employees in this Branch ---')
  const { data: employees, error: eError } = await supabase
    .from('employees')
    .select('id, first_name, last_name, employee_code, is_active')
    .eq('branch_id', branch.id)

  if (eError) {
    console.error('Error fetching employees:', eError.message)
    return
  }

  if (!employees || employees.length === 0) {
    console.log('No employees found in this branch.')
    return
  }

  for (const emp of employees) {
    console.log(`- ${emp.first_name} ${emp.last_name} [${emp.is_active ? 'ACTIVE' : 'INACTIVE'}]`)
    console.log(`  employee_code (Employee ID display): ${emp.employee_code}`)
    
    // Check active pins
    const { data: pins, error: pError } = await supabase
      .from('employee_pins')
      .select('pin, is_active')
      .eq('employee_id', emp.id)
      .eq('is_active', true)

    if (pError) {
      console.error('  Error fetching pins:', pError.message)
    } else {
      console.log('  Active PINs in employee_pins table:', pins.map(p => p.pin).join(', '))
    }
  }
}

run()
