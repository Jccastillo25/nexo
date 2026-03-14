'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

export type ActionState = { error: string } | null

export async function createCompany(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const supabase = await createClient()

  const display_name = formData.get('display_name') as string
  const legal_name = formData.get('legal_name') as string
  const slug = formData.get('slug') as string
  const tax_id = formData.get('tax_id') as string

  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  console.log("== AUTH CHECK IN SERVER ACTION ==", user?.id, authErr?.message)

  if (!user) {
    return { error: 'No tienes una sesión activa para crear empresas (Server Action Auth failed).' }
  }

  const { data: newCompanyId, error } = await supabase.rpc('create_company_with_owner', {
    p_display_name: display_name,
    p_legal_name: legal_name,
    p_slug: slug.toLowerCase().replace(/\s+/g, '-'),
    p_tax_id: tax_id || null,
  })

  console.log("== RPC RESULT ==", newCompanyId, error)

  if (error) {
    if (error.code === '23505' && error.message.includes('slug')) {
      return { error: 'El slug/identificador ya está en uso por otra empresa.' }
    }
    return { error: error.message }
  }

  revalidatePath('/organization/companies')
  redirect('/organization/companies')
}
