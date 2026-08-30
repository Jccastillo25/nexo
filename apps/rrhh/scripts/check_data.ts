import 'dotenv/config'
import { createAdminClient } from '../src/lib/supabase/admin'

async function checkDatabaseData() {
  const adminClient = createAdminClient()

  console.log('--- COMPROBANDO EMPRESAS ---')
  const { data: companies, error: cErr } = await adminClient.from('companies').select('id, display_name')
  if (cErr) console.error(cErr)
  console.log(companies)

  console.log('\n--- COMPROBANDO EMPLEADOS ---')
  const { data: employees, error: eErr } = await adminClient.from('employees').select('id, first_name, last_name, company_id')
  if (eErr) console.error(eErr)
  
  console.log(`Total empleados encontrados: ${employees?.length || 0}`)
  
  if (employees && employees.length > 0) {
    const grouped = employees.reduce((acc: any, emp: any) => {
      const cid = emp.company_id || 'SIN_COMPAÑIA'
      if (!acc[cid]) acc[cid] = 0
      acc[cid]++
      return acc
    }, {})
    
    console.log('Empleados por company_id:', grouped)
    console.log('Primeros 5:', employees.slice(0, 5))
  }
}

checkDatabaseData()
