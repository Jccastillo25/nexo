import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()

  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr) return Response.json({ authErr })
  
  const { data: myMemberships } = await supabase.from('company_memberships').select('*')
  
  const company_id = 'f135987e-fa39-41b9-9daf-869eae2379c2'
  
  const { data: myEmployees, error: empErr } = await supabase
    .from('employees')
    .select('id, first_name, last_name, email, is_active, company_id')
    .eq('company_id', company_id)
    
  return Response.json({
    user: user?.id,
    myMemberships,
    myEmployees,
    empErr
  })
}
