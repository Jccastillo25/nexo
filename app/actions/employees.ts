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
  redirect('/employees')
}
