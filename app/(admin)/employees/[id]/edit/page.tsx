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
      .select('id')
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
          className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-slate-500 shadow-sm ring-1 ring-slate-200 transition hover:bg-slate-50 hover:text-slate-900"
        >
          ←
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Editar colaborador</h1>
          <p className="text-sm text-slate-500">Actualiza la información de {employee.first_name ?? 'este colaborador'}.</p>
        </div>
      </div>

      <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200 sm:p-8">
        <EmployeeEditWizard
          employee={employee}
          branches={branches ?? []}
          hasActiveContract={hasActiveContract}
        />
      </div>
    </section>
  )
}
