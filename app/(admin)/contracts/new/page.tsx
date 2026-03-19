import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { HiringWizard } from './hiring-wizard'

export default async function NewContractPage() {
  const supabase = await createClient()

  // Fetch employees that might need a contract
  const { data: employees } = await supabase
    .from('employees')
    .select('id, first_name, last_name, email, is_active')
    .order('first_name')

  return (
    <section className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href="/contracts"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-slate-500 shadow-sm ring-1 ring-slate-200 transition hover:bg-slate-50 hover:text-slate-900"
        >
          ←
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Nueva Contratación</h1>
          <p className="text-sm text-slate-500">Completa los pasos para vincular un empleado con un turno.</p>
        </div>
      </div>

      <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200 sm:p-10">
        <HiringWizard initialEmployees={employees || []} />
      </div>
    </section>
  )
}
