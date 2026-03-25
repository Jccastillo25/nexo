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
  const email = formData.get('email') as string
  const branch_id = formData.get('branch_id') as string // Now optional

  if (!first_name || !last_name) {
    return { error: 'Nombre y apellido son requeridos.' }
  }

  // Obtener company_id del usuario autenticado
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: 'No tienes una sesión activa.' }
  }

  const { data: membership } = await supabase
    .from('company_memberships')
    .select('company_id')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .limit(1)
    .single()

  if (!membership?.company_id) {
    return { error: 'No se encontró una empresa asociada a tu cuenta.' }
  }

  // Generar un employee_code único usando UUID
  // Formato: EMP-[UUID corta de 8 caracteres]
  const crypto = await import('crypto')
  const employee_code = `EMP-${crypto.randomUUID().substring(0, 8).toUpperCase()}`

  // Se omite la generación del PIN aquí.
  // El PIN se genera posteriormente desde la pestaña de "Seguridad y Kiosko"
  // una vez que el empleado tiene un turno asignado.
  const { error } = await supabase.from('employees').insert({
    employee_code,
    first_name,
    last_name,
    email: email || null,
    branch_id: branch_id || null,
    company_id: membership?.company_id || null,
    is_active: true,
  })

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/employees')
  revalidatePath('/(admin)/employees', 'page')
  redirect('/employees')
}

export async function updateEmployee(
  id: string,
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const supabase = await createClient()

  const first_name = formData.get('first_name') as string
  const last_name = formData.get('last_name') as string
  const email = formData.get('email') as string
  const phone = formData.get('phone') as string
  const hire_date = formData.get('hire_date') as string
  const branch_id = formData.get('branch_id') as string // Optional
  const national_id = formData.get('national_id') as string
  const social_security_id = formData.get('social_security_id') as string
  const tax_id = formData.get('tax_id') as string
  const birth_date = formData.get('birth_date') as string
  const gender = formData.get('gender') as string
  const address = formData.get('address') as string
  const is_active = formData.get('is_active') === 'on'

  if (!first_name || !last_name) {
    return { error: 'Nombre y apellido son requeridos.' }
  }

  // If branch is provided, sync company_id. If not, keep nulls or existing
  let company_id = null
  if (branch_id) {
    const { data: branchData } = await supabase
      .from('branches')
      .select('company_id')
      .eq('id', branch_id)
      .single()
    company_id = branchData?.company_id || null
  }

  const { error } = await supabase
    .from('employees')
    .update({
      first_name,
      last_name,
      email: email || null,
      phone: phone || null,
      hire_date: hire_date || null,
      branch_id: branch_id || null,
      company_id: company_id,
      is_active,
      national_id: national_id || null,
      social_security_id: social_security_id || null,
      tax_id: tax_id || null,
      birth_date: birth_date || null,
      gender: gender || null,
      address: address || null,
    })
    .eq('id', id)

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/employees')
  revalidatePath(`/(admin)/employees/${id}`, 'page')
  revalidatePath(`/(admin)/employees/${id}/edit`, 'page')
  redirect(`/employees/${id}`)
}

export async function toggleEmployeeStatus(id: string, currentStatus: boolean) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('employees')
    .update({ is_active: !currentStatus })
    .eq('id', id)

  if (error) throw error
  revalidatePath('/employees')
  revalidatePath(`/(admin)/employees/${id}`, 'page')
}
