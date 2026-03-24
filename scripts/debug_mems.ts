import { createAdminClient } from '@/lib/supabase/admin'

async function debugMemberships() {
  const admin = createAdminClient()
  
  // Use the email from the screenshot: jcastillo@materialesjcastillo.com (approx)
  // Actually, I'll search by the name or just list all memberships to find the user
  const { data: users } = await admin.from('profiles').select('id, email, full_name').ilike('email', '%jcastillo%')
  
  console.log('--- USER DEBUG ---')
  if (!users || users.length === 0) {
    console.log('No user found with that email pattern.')
    return
  }

  for (const user of users) {
    console.log(`User Found: ${user.full_name} (${user.email}) ID: ${user.id}`)
    
    const { data: mems, error } = await admin
      .from('company_memberships')
      .select('company_id, role, is_active, companies(display_name, slug)')
      .eq('user_id', user.id)

    if (error) {
       console.log(`Error fetching for ${user.id}:`, error.message)
       continue
    }

    console.log(`Memberships Found (${mems?.length || 0}):`)
    mems?.forEach(m => {
      console.log(`- Co: ${(m.companies as any)?.display_name} [${m.company_id}] Role: ${m.role} Active: ${m.is_active}`)
    })
  }
  console.log('--- END DEBUG ---')
}

debugMemberships()
