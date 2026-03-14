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

  if (!display_name || !legal_name || !slug) {
    return { error: 'Nombre, Razón Social y Slug son obligatorios.' }
  }

  const { error } = await supabase.from('companies').insert({
    display_name,
    legal_name,
    slug: slug.toLowerCase().replace(/\s+/g, '-'),
    tax_id: tax_id || null,
    is_active: true,
  })

  if (error) {
    if (error.code === '23505' && error.message.includes('slug')) {
      return { error: 'El slug/identificador ya está en uso por otra empresa.' }
    }
    return { error: error.message }
  }

  revalidatePath('/organization/companies')
  redirect('/organization/companies')
}
