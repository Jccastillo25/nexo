import { createAdminClient } from '@/lib/supabase/admin'

async function checkData() {
  const admin = createAdminClient()

  console.log('--- GLOBAL DATA CHECK ---')
  
  // 1. All Companies
  const { data: cos } = await admin.from('companies').select('id, display_name, slug')
  console.log('Companies in DB:', cos?.length || 0)
  cos?.forEach(c => console.log(`- ${c.display_name} (${c.slug}) ID: ${c.id}`))

  // 2. All Employees with their Company
  const { data: emps } = await admin.from('employees').select('id, first_name, last_name, company_id')
  console.log('Employees in DB:', emps?.length || 0)
  
  const orphanCount = emps?.filter(e => !e.company_id).length || 0
  console.log('Orphan Employees (no company_id):', orphanCount)

  const coCounts: Record<string, number> = {}
  emps?.forEach(e => {
    if (e.company_id) {
      coCounts[e.company_id] = (coCounts[e.company_id] || 0) + 1
    }
  })

  Object.entries(coCounts).forEach(([id, count]) => {
    const name = cos?.find(c => c.id === id)?.display_name || 'Desconocido'
    console.log(`- Co: ${name} [${id}]: ${count} empleados`)
  })

  console.log('--- CHECK END ---')
}

checkData()
