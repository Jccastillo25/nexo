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
  const company_id = formData.get('company_id') as string
  const branch_id = formData.get('branch_id') as string
  const contract_type = formData.get('contract_type') as string
  const salary = parseFloat(formData.get('salary') as string)
  const start_date = formData.get('start_date') as string
  const end_date = formData.get('end_date') as string

  if (!employee_id || !schedule_id || !company_id || !branch_id) {
    return { error: 'Empleado, turno, empresa y sucursal son requeridos.' }
  }

  // 1. Generate PIN (4 random digits)
  const pin = Math.floor(1000 + Math.random() * 9000).toString()

  // 2. Generate Employee Number (COMP-BR-XXX)
  const { data: company } = await supabase.from('companies').select('abbreviation').eq('id', company_id).single()
  const { data: branch } = await supabase.from('branches').select('code').eq('id', branch_id).single()
  
  const { count } = await supabase
    .from('employees')
    .select('*', { count: 'exact', head: true })
    .eq('company_id', company_id)

  const seq = (count || 0) + 1
  const employee_number = `${company?.abbreviation || 'EMP'}-${branch?.code || 'SUC'}-${seq.toString().padStart(3, '0')}`

  // 3. Update Employee with PIN, Employee Number, Company and Branch
  const { error: empUpdateErr } = await supabase
    .from('employees')
    .update({
      company_id,
      branch_id,
      pin,
      employee_number,
      employee_code: pin, // Legacy support
      hire_date: start_date
    })
    .eq('id', employee_id)

  if (empUpdateErr) {
    return { error: `Error al actualizar perfil de empleado: ${empUpdateErr.message}` }
  }

  // 4. Create the contract
  const { error: contractErr } = await supabase.from('contracts').insert({
    employee_id,
    schedule_id,
    company_id,
    branch_id,
    contract_type,
    salary: isNaN(salary) ? 0 : salary,
    status: 'active',
    start_date: start_date || new Date().toISOString().split('T')[0],
    end_date: end_date || null,
  })

  if (contractErr) {
    return { error: `Error al crear contrato: ${contractErr.message}` }
  }

  // 5. Link shift in employee_shifts
  await supabase
    .from('employee_shifts')
    .update({ is_active: false })
    .eq('employee_id', employee_id)

  await supabase.from('employee_shifts').insert({
    employee_id,
    shift_id: schedule_id,
    start_date: start_date,
    is_active: true,
  })

  revalidatePath('/employees')
  revalidatePath(`/employees/${employee_id}`)
  revalidatePath('/contracts')
  
  redirect('/contracts')
}

export async function updateContract(
  id: string,
  _prevState: ContractActionState,
  formData: FormData
): Promise<ContractActionState> {
  const supabase = await createClient()

  const schedule_id = formData.get('schedule_id') as string
  const contract_type = formData.get('contract_type') as string
  const salary = parseFloat(formData.get('salary') as string)
  const start_date = formData.get('start_date') as string
  const end_date = formData.get('end_date') as string
  const status = formData.get('status') as string

  // 1. Update the contract
  const { data: contract, error: contractErr } = await supabase
    .from('contracts')
    .update({
      schedule_id,
      contract_type,
      salary: isNaN(salary) ? 0 : salary,
      start_date,
      end_date: end_date || null,
      status: status || 'active'
    })
    .eq('id', id)
    .select()
    .single()

  if (contractErr) {
    return { error: `Error al actualizar contrato: ${contractErr.message}` }
  }

  const employee_id = contract.employee_id

  // 2. Sync with employee_shifts (if schedule or dates changed)
  // We'll follow the simple pattern of deactivating old ones for this employee
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

export async function markContractAsPrinted(id: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('contracts')
    .update({ is_printed: true })
    .eq('id', id)
  
  if (error) return { error: error.message }
  revalidatePath('/contracts')
  return {}
}

export async function annulContract(id: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('contracts')
    .update({ status: 'annulled', is_active: false })
    .eq('id', id)
  
  if (error) return { error: error.message }
  revalidatePath('/contracts')
  return {}
}

export async function deleteContract(id: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  
  // 1. Check if already printed
  const { data: contract } = await supabase
    .from('contracts')
    .select('is_printed')
    .eq('id', id)
    .single()
  
  if (contract?.is_printed) {
    return { error: 'No se puede eliminar un contrato que ya ha sido impreso. Debe anularlo.' }
  }

  const { error } = await supabase.from('contracts').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/contracts')
  return {}
}
