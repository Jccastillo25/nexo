const SUPABASE_URL = 'https://ofeuzkwjhmfsazqfyutu.supabase.co'
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9mZXV6a3dqaG1mc2F6cWZ5dXR1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzAzMDIwOSwiZXhwIjoyMDg4NjA2MjA5fQ.YSwvkWvgglrl3J1KYdCYpZtrEe7VXJIFplxMfM479TM'

async function run() {
  const headers = {
    'apikey': SERVICE_KEY,
    'Authorization': `Bearer ${SERVICE_KEY}`
  }
  
  try {
    const empRes = await fetch(`${SUPABASE_URL}/rest/v1/employees?select=id,first_name,last_name,company_id`, { headers })
    const employees = await empRes.json()
    
    const compRes = await fetch(`${SUPABASE_URL}/rest/v1/companies?select=id,display_name`, { headers })
    const companies = await compRes.json()
    
    // Log User 12059367-9d7a-4286... (jcastillo) memberships
    const memRes = await fetch(`${SUPABASE_URL}/rest/v1/company_memberships?select=*`, { headers })
    const memberships = await memRes.json()
    
    console.log('--- COMPANIAS ---')
    console.table(companies)
    
    console.log('\n--- MIEMBROS ---')
    console.table(memberships)
    
    console.log(`\n--- EMPLEADOS ENCONTRADOS: ${employees.length} ---`)
    const grouped = {}
    employees.forEach(e => {
      const cid = e.company_id || 'SIN ASIGNAR'
      grouped[cid] = (grouped[cid] || 0) + 1
    })
    
    console.log('Cantidad por empresa:', grouped)
    console.log('Muestra de 3 empleados:', employees.slice(0, 3))
  } catch (err) {
    console.error(err)
  }
}

run()
