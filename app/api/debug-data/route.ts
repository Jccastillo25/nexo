import { createAdminClient } from '@/lib/supabase/admin'

export async function GET() {
  const adminClient = createAdminClient()

  const { data: companies } = await adminClient.from('companies').select('id, display_name, slug')
  const { data: employees } = await adminClient.from('employees').select('id, first_name, last_name, company_id')
  const { data: memberships } = await adminClient.from('company_memberships').select('*')

  const employeesByCompany = employees?.reduce((acc: any, emp: any) => {
    const cid = emp.company_id || 'NULL'
    if (!acc[cid]) acc[cid] = 0
    acc[cid]++
    return acc
  }, {})

  return Response.json({
    companies,
    employeesByCompany,
    memberships,
    sampleEmployees: employees?.slice(0, 10)
  })
}
