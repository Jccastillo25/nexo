import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const env = fs.readFileSync('.env.local', 'utf8')
const envMap = Object.fromEntries(env.split('\n').filter(l => l.includes('=')).map(l => l.split('=')))

const supabaseUrl = envMap.NEXT_PUBLIC_SUPABASE_URL?.trim()
const supabaseKey = envMap.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim()

const supabase = createClient(supabaseUrl, supabaseKey)

async function run() {
  console.log('--- Diagnostic: Checking Employee and PIN Data ---')
  
  const { data: employees, error: eError } = await supabase
    .from('employees')
    .select('id, first_name, last_name, employee_code, is_active')
    .order('updated_at', { ascending: false })
    .limit(5)

  if (eError) {
    console.error('Error fetching employees:', eError.message)
    return
  }

  for (const emp of employees) {
    console.log(`Employee: ${emp.first_name} ${emp.last_name} (ID: ${emp.id})`)
    console.log(`  employee_code (in employees table): ${emp.employee_code}`)
    
    const { data: pins, error: pError } = await supabase
      .from('employee_pins')
      .select('pin, is_active')
      .eq('employee_id', emp.id)
      .eq('is_active', true)
      .limit(1)

    if (pError) {
      console.error(`  Error fetching pins for ${emp.id}:`, pError.message)
    } else if (pins.length === 0) {
      console.log(`  No active PIN found in employee_pins table!`)
    } else {
      console.log(`  pin (in employee_pins table): ${pins[0].pin}`)
      if (emp.employee_code !== pins[0].pin) {
        console.log(`  !!! MISMATCH DETECTED: employee_code != pin !!!`)
      } else {
        console.log(`  Match confirmed: ${emp.employee_code}`)
      }
    }
  }
}

run()
