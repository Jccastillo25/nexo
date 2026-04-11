import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { EmployeeEditWizard } from './employee-edit-wizard'

export default async function EditEmployeePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const [
    { data: employeeData },
    { data: branches },
    { data: contract }
  ] = await Promise.all([
    supabase
      .from('employees')
      .select('id, employee_code, employee_number, first_name, last_name, email, phone, hire_date, national_id, social_security_id, tax_id, birth_date, gender, address, branch_id, is_active, photo_url')
      .eq('id', id)
      .single(),
    supabase
      .from('branches')
      .select('id, name')
      .eq('is_active', true)
      .order('name'),
    supabase
      .from('contracts')
      .select('id, social_security_number, hire_date')
      .eq('employee_id', id)
      .eq('status', 'active')
      .maybeSingle()
  ])

  const employee = employeeData as unknown as any
  const hasActiveContract = !!contract

  if (!employee) notFound()

  return (
    <section className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href={`/employees/${id}`}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-800 border border-slate-700 text-slate-400 shadow-sm transition hover:bg-slate-700 hover:text-white"
        >
          ←
        </Link>
        <div>
          <h1 className="text-2xl font-black tracking-tight text-white">Editar colaborador</h1>
          <p className="mt-1 text-sm text-slate-400">Actualiza la información de <span className="font-bold text-white max-w-xs truncate">{employee.first_name ?? 'este colaborador'}</span>.</p>
        </div>
      </div>

      <div className="app-surface p-6 sm:p-8">
        <EmployeeEditWizard
          employee={employee}
          branches={branches ?? []}
          hasActiveContract={hasActiveContract}
          activeContract={contract || undefined}
        />
      </div>
    </section>
  )
}
