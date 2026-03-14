import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { EmployeeEditForm } from './employee-edit-form'

export default async function EditEmployeePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const [
    { data: employee },
    { data: branches }
  ] = await Promise.all([
    supabase
      .from('employees')
      .select('id, first_name, last_name, email, phone, hire_date, national_id, social_security_id, tax_id, birth_date, gender, address, branch_id, is_active')
      .eq('id', id)
      .single(),
    supabase
      .from('branches')
      .select('id, name')
      .eq('is_active', true)
      .order('name')
  ])

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
          <p className="text-sm text-slate-500">Actualiza la información de {employee.first_name}.</p>
        </div>
      </div>

      <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200 sm:p-8">
        <EmployeeEditForm employee={employee} branches={branches ?? []} />
      </div>
    </section>
  )
}
