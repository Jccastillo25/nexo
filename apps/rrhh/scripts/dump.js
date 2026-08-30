const fs = require('fs')
const SUPABASE_URL = 'https://ofeuzkwjhmfsazqfyutu.supabase.co'
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9mZXV6a3dqaG1mc2F6cWZ5dXR1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzAzMDIwOSwiZXhwIjoyMDg4NjA2MjA5fQ.YSwvkWvgglrl3J1KYdCYpZtrEe7VXJIFplxMfM479TM'

async function run() {
  const headers = { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}` }
  const empRes = await fetch(`${SUPABASE_URL}/rest/v1/employees?select=id,first_name,last_name,company_id,is_active`, { headers })
  const employees = await empRes.json()
  const compRes = await fetch(`${SUPABASE_URL}/rest/v1/companies?select=id,display_name`, { headers })
  const companies = await compRes.json()
  const memsRes = await fetch(`${SUPABASE_URL}/rest/v1/company_memberships?select=*`, { headers })
  const memberships = await memsRes.json()
  
  const out = {
    empresas: companies,
    miembros: memberships,
    empleados: employees
  }
  
  fs.writeFileSync('scripts/debug_output2.json', JSON.stringify(out, null, 2))
}
run()
