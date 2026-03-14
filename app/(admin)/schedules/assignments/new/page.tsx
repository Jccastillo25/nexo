import { createClient } from '@/lib/supabase/server'
import { AssignmentForm } from '../assignment-form'
import Link from 'next/link'

export default async function NewAssignmentPage() {
  const supabase = await createClient()

  const [
    { data: employees },
    { data: shifts },
    { data: branches }
  ] = await Promise.all([
    supabase.from('employees').select('id, first_name, last_name, branch_id').eq('is_active', true).order('first_name'),
    supabase.from('shifts').select('id, name').eq('is_active', true).order('name'),
    supabase.from('branches').select('id, name').order('name')
  ])

  return (
    <section className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Nueva Asignación</h1>
          <p className="mt-2 text-slate-600">Vincular un empleado con un horario maestro.</p>
        </div>
        <Link
          href="/schedules/assignments"
          className="text-sm font-semibold text-slate-600 hover:text-slate-900"
        >
          ← Volver
        </Link>
      </div>

      <div className="rounded-3xl bg-white p-8 shadow-sm ring-1 ring-slate-200">
        <AssignmentForm 
          employees={employees || []} 
          shifts={shifts || []} 
          branches={branches || []} 
        />
      </div>
    </section>
  )
}
