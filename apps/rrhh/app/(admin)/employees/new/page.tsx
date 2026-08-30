import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { EmployeeForm } from './employee-form'

export default async function NewEmployeePage() {
  const supabase = await createClient()

  // 1. Fetch Branches
  const { data: branches } = await supabase
    .from('branches')
    .select('id, name, company_id')
    .eq('is_active', true)
    .order('name')

  // 2. Fetch Job Positions
  const { data: positions } = await supabase
    .from('job_positions')
    .select('id, name, company_id')
    .eq('is_active', true)
    .order('name')

  // 3. Fetch Shift Templates
  const { data: templates } = await supabase
    .from('shift_templates')
    .select('id, name')
    .eq('is_active', true)
    .order('name')

  return (
    <section className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href="/employees"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-800 border border-slate-700 text-slate-400 shadow-sm transition hover:bg-slate-700 hover:text-white"
        >
          ←
        </Link>
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight">Nuevo colaborador</h1>
          <p className="mt-1 text-sm text-slate-400">Registra un empleado y asígnale su PIN de acceso.</p>
        </div>
      </div>

      <div className="app-surface p-6 sm:p-8">
        <EmployeeForm 
          branches={branches ?? []} 
          positions={positions ?? []}
          templates={templates ?? []}
        />
      </div>
    </section>
  )
}
