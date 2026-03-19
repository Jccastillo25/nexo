'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

export type ActionState = { error: string } | null

export async function createShift(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const supabase = await createClient()

  const name = formData.get('name') as string
  const start_time = formData.get('start_time') as string
  const end_time = formData.get('end_time') as string
  const break_minutes = parseInt(formData.get('break_minutes') as string, 10)
  const tolerance_in = parseInt(formData.get('tolerance_in') as string, 10)
  const tolerance_out = parseInt(formData.get('tolerance_out') as string, 10)

  if (!name || !start_time || !end_time) {
    return { error: 'Nombre, hora de entrada y hora de salida son requeridos.' }
  }

  const { error } = await supabase.from('shifts').insert({
    name,
    start_time,
    end_time,
    break_minutes: isNaN(break_minutes) ? 0 : break_minutes,
    tolerance_in: isNaN(tolerance_in) ? 0 : tolerance_in,
    tolerance_out: isNaN(tolerance_out) ? 0 : tolerance_out,
    is_active: true,
  })

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/schedules')
  redirect('/schedules')
}

export async function assignShift(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const supabase = await createClient()

  const employee_id = formData.get('employee_id') as string
  const shift_id = formData.get('shift_id') as string
  const start_date = formData.get('start_date') as string

  if (!employee_id || !shift_id) {
    return { error: 'Empleado y turno son requeridos.' }
  }

  // Desactivar asignaciones previas para este empleado
  const { error: deactivateError } = await supabase
    .from('employee_shifts')
    .update({ is_active: false })
    .eq('employee_id', employee_id)

  if (deactivateError) {
    return { error: 'No se pudieron desactivar los turnos anteriores.' }
  }

  // Insertar nueva asignación
  const { error } = await supabase.from('employee_shifts').insert({
    employee_id,
    shift_id,
    start_date: start_date || new Date().toISOString().split('T')[0],
    is_active: true,
  })

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/schedules/assignments')
  redirect('/schedules/assignments')
}
