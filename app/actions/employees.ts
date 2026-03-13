'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

export type ActionState = { error: string } | null

export async function createEmployee(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const supabase = await createClient()

  const first_name = formData.get('first_name') as string
  const last_name = formData.get('last_name') as string
  const employee_code = formData.get('employee_code') as string
  const email = formData.get('email') as string
  const branch_id = formData.get('branch_id') as string

  if (!first_name || !last_name || !employee_code || !branch_id) {
    return { error: 'Nombre, apellido, PIN de acceso y sucursal son requeridos.' }
  }

  const { error } = await supabase.from('employees').insert({
    employee_code,
    first_name,
    last_name,
    email: email || null,
    branch_id,
    is_active: true,
  })

  if (error) {
    if (error.code === '23505') {
       return { error: 'El código de empleado (PIN) ya está en uso. Elige uno diferente.' }
    }
    return { error: error.message }
  }

  revalidatePath('/employees')
  redirect('/employees')
}
