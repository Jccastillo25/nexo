const fs = require('fs')
const SUPABASE_URL = 'https://ofeuzkwjhmfsazqfyutu.supabase.co'
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9mZXV6a3dqaG1mc2F6cWZ5dXR1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzAzMDIwOSwiZXhwIjoyMDg4NjA2MjA5fQ.YSwvkWvgglrl3J1KYdCYpZtrEe7VXJIFplxMfM479TM'

async function run() {
  const headers = { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}` }
  // To get schema, we can query postgrest OpenAPI def
  const res = await fetch(`${SUPABASE_URL}/rest/v1/?apikey=${SERVICE_KEY}`)
  const openapi = await res.json()
  
  const tables = ['contracts', 'shift_templates', 'leave_requests', 'employee_status', 'companies', 'employees', 'profiles']
  const info = {}
  
  tables.forEach(t => {
    if (openapi.definitions[t]) {
      info[t] = Object.keys(openapi.definitions[t].properties)
    }
  })
  
  fs.writeFileSync('scripts/schema.json', JSON.stringify(info, null, 2))
}
run()
