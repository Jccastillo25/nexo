import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function diagnostic() {
  console.log('--- DIAGNOSTIC START ---')
  
  // 1. List all companies
  const { data: companies, error: coErr } = await supabase.from('companies').select('id, display_name, slug')
  console.log('Total Companies:', companies?.length || 0)
  companies?.forEach(c => console.log(`- ${c.display_name} (${c.slug}) [${c.id}]`))

  // 2. List all memberships
  const { data: memberships, error: memErr } = await supabase.from('company_memberships').select('user_id, company_id, role, is_active')
  console.log('Total Memberships:', memberships?.length || 0)
  memberships?.forEach(m => console.log(`- User: ${m.user_id} -> Co: ${m.company_id} (${m.role})`))

  // 3. List recent users
  const { data: users, error: authErr } = await supabase.auth.admin.listUsers()
  console.log('Total Users:', users?.users?.length || 0)
  users?.users?.forEach(u => console.log(`- ${u.email} [${u.id}]`))

  console.log('--- DIAGNOSTIC END ---')
}

diagnostic()
