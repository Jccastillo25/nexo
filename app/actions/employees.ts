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
  const branch_id = formData.get('branch_id') as string

  if (!first_name || !last_name || !branch_id) {
    return { error: 'Nombre, apellido y sucursal son requeridos.' }
  }

  // Generar PIN aleatorio de 4 dígitos (1000 a 9999)
  const employee_code = Math.floor(1000 + Math.random() * 9000).toString()

  const { data: newEmployee, error } = await supabase.from('employees').insert({
    employee_code,
    first_name,
    last_name,
    email: email || null,
    branch_id,
    is_active: true,
    // Nuevos campos inicializados en null o vacíos si se desea
  }).select('id').single()

  if (error) {
    if (error.code === '23505') {
       return { error: 'Ocurrió una colisión en el PIN temporal. Por favor, intenta guardar de nuevo.' }
    }
    return { error: error.message }
  }

  // Insertar el pin en employee_pins para el historial de control de seguridad (si la tabla lo requiere explícitamente)
  // El kiosko RPC 'kiosk_clock_event' típicamente cruza information o el trigger insertó uno. Intentamos insertarlo por si no hay trigger.
  await supabase.from('employee_pins').insert({
    employee_id: newEmployee.id,
    pin: employee_code, // Asumimos que la columna se llama pin
    is_active: true
  })

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
  const branch_id = formData.get('branch_id') as string
  const national_id = formData.get('national_id') as string
  const social_security_id = formData.get('social_security_id') as string
  const tax_id = formData.get('tax_id') as string
  const birth_date = formData.get('birth_date') as string
  const gender = formData.get('gender') as string
  const address = formData.get('address') as string

  if (!first_name || !last_name || !branch_id) {
    return { error: 'Nombre, apellido y sucursal son requeridos.' }
  }

  const { error } = await supabase
    .from('employees')
    .update({
      first_name,
      last_name,
      email: email || null,
      phone: phone || null,
      hire_date: hire_date || null,
      branch_id,
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
