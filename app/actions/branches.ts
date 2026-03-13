'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

export type ActionState = { error: string } | null

export async function createBranch(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const supabase = await createClient()

  const name = formData.get('name') as string
  const code = formData.get('code') as string
  const company_id = formData.get('company_id') as string

  if (!name || !company_id) {
    return { error: 'El nombre y la empresa son requeridos.' }
  }

  const { error } = await supabase.from('branches').insert({
    name,
    code: code ? code : null,
    company_id,
    is_active: true,
  })

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/organization/branches')
  redirect('/organization/branches')
}
