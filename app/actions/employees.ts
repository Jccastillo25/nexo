'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requirePermission } from '@/lib/auth/require-permission'

export type ActionState = { error: string } | null

export async function createEmployee(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const perm = await requirePermission('can_manage_employees')
  if (!perm.ok) return { error: perm.error }
  const supabase = await createClient()

  const first_name = formData.get('first_name') as string
  const last_name = formData.get('last_name') as string
  const email = formData.get('email') as string
  const branch_id = formData.get('branch_id') as string 
  const job_position_id = formData.get('job_position_id') as string
  const shift_template_id = formData.get('shift_template_id') as string

  if (!first_name || !last_name) {
    return { error: 'Nombre y apellido son requeridos.' }
  }

  // Obtener company_id del usuario autenticado
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: 'No tienes una sesión activa.' }
  }

  const { data: membership, error: membershipError } = await supabase
    .from('company_memberships')
    .select('company_id')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (membershipError || !membership?.company_id) {
    console.error('Membership error:', membershipError)
    return { error: 'No se encontró una empresa asociada a tu cuenta.' }
  }

  const company_id = membership.company_id

  // Generar un PIN numérico de 4 dígitos único para el kiosco
  const { generateUniquePin } = await import('@/lib/utils')
  const employee_code = await generateUniquePin(supabase, company_id)

  // 1. Insertar Empleado
  const { data: employee, error: empError } = await supabase.from('employees').insert({
    employee_code,
    first_name,
    last_name,
    email: email || null,
    branch_id: branch_id || null,
    company_id,
    is_active: true,
  }).select('id').single()

  if (empError) return { error: empError.message }

  // 2. Crear Asignación (Job + Shift)
  if (job_position_id) {
    const { error: assError } = await supabase.from('employee_assignments').insert({
      employee_id: employee.id,
      job_position_id,
      shift_template_id: shift_template_id || null,
      branch_id: branch_id || null, // Se asume que branches existen
      company_id,
      is_active: true
    })
    if (assError) return { error: `Error al crear la asignación: ${assError.message}` }
  }


  revalidatePath('/employees')
  revalidatePath('/(admin)/employees', 'page')
  redirect('/employees')
}

export async function updateEmployee(
  id: string,
  shouldRedirect: boolean,
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState & { success?: boolean }> {
  const perm = await requirePermission('can_manage_employees')
  if (!perm.ok) return { error: perm.error }
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
  const is_active = formData.get('is_active') === 'on'

  const job_position_id = formData.get('job_position_id') as string
  const shift_template_id = formData.get('shift_template_id') as string

  if (!first_name || !last_name) {
    return { error: 'Nombre y apellido son requeridos.' }
  }

  // Sync company_id from branch or employee record
  let company_id = null
  const { data: empData } = await supabase.from('employees').select('company_id').eq('id', id).single()
  company_id = empData?.company_id

  if (branch_id) {
    const { data: branchData } = await supabase
      .from('branches')
      .select('company_id')
      .eq('id', branch_id)
      .single()
    if (branchData) company_id = branchData.company_id
  }

  // 1. Update Employee
  const { error: empUpdateError } = await supabase
    .from('employees')
    .update({
      first_name,
      last_name,
      email: email || null,
      phone: phone || null,
      hire_date: hire_date || null,
      branch_id: branch_id || null,
      company_id,
      is_active,
      national_id: national_id || null,
      social_security_id: social_security_id || null,
      tax_id: tax_id || null,
      birth_date: birth_date || null,
      gender: gender || null,
      address: address || null,
    })
    .eq('id', id)

  if (empUpdateError) return { error: empUpdateError.message }

  // 2. Update/Upsert Assignment
  if (job_position_id && company_id && branch_id) {
    const { error: assError } = await supabase
      .from('employee_assignments')
      .upsert({
        employee_id: id,
        job_position_id,
        shift_template_id: shift_template_id || null,
        branch_id,
        company_id,
        is_active: true,
        updated_at: new Date().toISOString()
      }, { onConflict: 'employee_id,is_active' })
    
    if (assError) console.error('Error syncing assignment:', assError)
  }

  revalidatePath('/employees')
  revalidatePath(`/(admin)/employees/${id}`, 'page')
  revalidatePath(`/(admin)/employees/${id}/edit`, 'page')
  if (shouldRedirect) {
    redirect(`/employees/${id}`)
  }
  return { success: true } as any
}


export async function toggleEmployeeStatus(id: string, currentStatus: boolean) {
  const perm = await requirePermission('can_manage_employees')
  if (!perm.ok) throw new Error(perm.error)
  const supabase = await createClient()
  const { error } = await supabase
    .from('employees')
    .update({ is_active: !currentStatus })
    .eq('id', id)

  if (error) throw error
  revalidatePath('/employees')
  revalidatePath(`/(admin)/employees/${id}`, 'page')
}

export async function deleteEmployee(id: string): Promise<ActionState> {
  const perm = await requirePermission('can_manage_employees')
  if (!perm.ok) return { error: perm.error }
  const supabase = await createClient()

  // 1. Verificar si el empleado tiene contratos activos
  const { data: activeContracts, error: contractError } = await supabase
    .from('contracts')
    .select('id')
    .eq('employee_id', id)
    .eq('status', 'active')

  if (contractError) {
    return { error: 'Error al verificar contratos.' }
  }

  if (activeContracts && activeContracts.length > 0) {
    return {
      error: '⚠️ No se puede eliminar este empleado.\n\nTiene un contrato ACTIVO. Debe:\n1. Anular o finalizar el contrato\n2. Luego podrá eliminar el empleado'
    }
  }

  // 2. Si no hay contratos activos, proceder a eliminar
  const { error } = await supabase
    .from('employees')
    .delete()
    .eq('id', id)

  if (error) {
    return { error: `Error al eliminar empleado: ${error.message}` }
  }

  revalidatePath('/employees')
  return null
}
