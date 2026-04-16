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

  // 1. Fetch contract with explicit error handling
  const { data: contract, error: contractError } = await supabase
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
      shift_template_id,
      company_id,
      branch_id,
      job_position_id,
      social_security_number,
      hire_date,
      created_at
    `)
    .eq('id', id)
    .maybeSingle()

  if (contractError) {
    console.error('[EditContractPage] Error fetching contract:', contractError)
    // If it's a "column does not exist" error, it's likely a missing migration
    if (contractError.code === '42703') {
       return (
         <div className="p-10 bg-red-50 border border-red-200 rounded-2xl text-red-800">
           <h2 className="text-lg font-bold">Error de Base de Datos</h2>
           <p className="mt-2">Parece que faltan columnas en la tabla de contratos. Por favor, asegúrate de ejecutar la migración <code>20260325_contracts_inss_hire_date.sql</code> en el panel de Supabase.</p>
           <pre className="mt-4 p-4 bg-red-100 rounded text-xs overflow-auto">{JSON.stringify(contractError, null, 2)}</pre>
         </div>
       )
    }
  }

  if (!contract) {
    notFound()
  }

  // 2. Fetch employee details separately
  const { data: employee } = await supabase
    .from('employees')
    .select('id, first_name, last_name, job_position_id')
    .eq('id', contract.employee_id)
    .maybeSingle()

  // 3. Fetch all shifts for the selector
  const { data: shifts } = await supabase
    .from('shift_templates')
    .select('id, name, start_time, end_time')
    .eq('is_active', true)

  // 4. Fetch Job Positions
  const { data: jobPositions } = await supabase
    .from('job_positions')
    .select('id, name, company_id, parent_id')
    .eq('is_active', true)

  // 5. Fetch Branches
  const { data: branches } = await supabase
    .from('branches')
    .select('id, name, company_id')
    .eq('is_active', true)

  // 6. Fetch Contract Template for Live Preview
  const { data: template } = await supabase
    .from('contract_templates')
    .select('*')
    .limit(1)
    .maybeSingle()

  return (
    <section className="space-y-6">
      <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <h1 className="text-2xl font-bold text-slate-900">Editar Contratación</h1>
        <p className="mt-2 text-sm text-slate-500">
          Modificando contrato {employee ? `de ${employee.first_name} ${employee.last_name}` : '(Empleado no disponible)'}.
        </p>
      </div>

      <div className="rounded-3xl bg-white p-8 shadow-sm ring-1 ring-slate-200">
        <ContractForm 
          id={id} 
          initialData={contract} 
          shifts={shifts || []} 
          jobPositions={jobPositions || []}
          branches={branches || []}
          templateContent={template?.content || null}
          employee={employee}
        />
      </div>
    </section>
  )
}
