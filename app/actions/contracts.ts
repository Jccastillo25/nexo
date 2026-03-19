'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

export type ContractActionState = { error: string } | null

export async function createContract(
  _prevState: ContractActionState,
  formData: FormData
): Promise<ContractActionState> {
  const supabase = await createClient()

  const employee_id = formData.get('employee_id') as string
  const schedule_id = formData.get('schedule_id') as string
  const contract_type = formData.get('contract_type') as string
  const salary = parseFloat(formData.get('salary') as string)
  const start_date = formData.get('start_date') as string
  const end_date = formData.get('end_date') as string

  // Requirement: schedule_id is NOT NULL
  if (!employee_id || !schedule_id) {
    return { error: 'El empleado y el turno son obligatorios.' }
  }

  // Atomic transaction (Supabase doesn't support them easily via client, 
  // but we can do sequential updates)
  
  // 1. Create the contract
  const { data: contract, error: contractErr } = await supabase
    .from('contracts')
    .insert({
      employee_id,
      schedule_id,
      contract_type,
      salary: isNaN(salary) ? 0 : salary,
      start_date,
      end_date: end_date || null,
      status: 'active'
    })
    .select()
    .single()

  if (contractErr) {
    return { error: `Error al crear contrato: ${contractErr.message}` }
  }

  // 2. Update employee status to active
  const { error: empErr } = await supabase
    .from('employees')
    .update({ is_active: true })
    .eq('id', employee_id)

  if (empErr) {
    console.error('Error updating employee status:', empErr.message)
    // We don't fail the whole request here but log it
  }

  // 3. Link shift (redundant but matches current architecture of employee_shifts)
  await supabase
    .from('employee_shifts')
    .update({ is_active: false })
    .eq('employee_id', employee_id)

  await supabase
    .from('employee_shifts')
    .insert({
      employee_id,
      shift_id: schedule_id,
      start_date: start_date,
      is_active: true
    })

  revalidatePath('/employees')
  revalidatePath(`/employees/${employee_id}`)
  revalidatePath('/contracts')
  
  redirect('/contracts')
}
