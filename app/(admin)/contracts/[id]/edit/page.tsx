import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { ContractForm } from './contract-form'

export default async function EditContractPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  // 1. Fetch contract (without relations to avoid JSON coercion issues)
  const { data: contract } = await supabase
    .from('contracts')
    .select(`
      id,
      employee_id,
      contract_type,
      salary,
      currency,
      status,
      start_date,
      end_date,
      schedule_id,
      company_id,
      branch_id,
      job_position_id,
      social_security_number,
      hire_date,
      created_at
    `)
    .eq('id', id)
    .maybeSingle()

  if (!contract) {
    notFound()
  }

  // 2. Fetch employee details separately
  const { data: employee } = await supabase
    .from('employees')
    .select('id, first_name, last_name, job_position_id')
    .eq('id', contract.employee_id)
    .single()

  // 3. Fetch all shifts for the selector
  const { data: shifts } = await supabase
    .from('shifts')
    .select('id, name, start_time, end_time')
    .eq('is_active', true)

  // 4. Fetch Job Positions
  const { data: jobPositions } = await supabase
    .from('job_positions')
    .select('id, name, company_id, parent_id')
    .eq('is_active', true)

  return (
    <section className="space-y-6">
      <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <h1 className="text-2xl font-bold text-slate-900">Editar Contratación</h1>
        <p className="mt-2 text-sm text-slate-500">
          Modificando contrato de <span className="font-bold text-slate-900">{employee?.first_name} {employee?.last_name}</span>.
        </p>
      </div>

      <div className="rounded-3xl bg-white p-8 shadow-sm ring-1 ring-slate-200">
        <ContractForm 
          id={id} 
          initialData={contract} 
          shifts={shifts || []} 
          jobPositions={jobPositions || []}
        />
      </div>
    </section>
  )
}
