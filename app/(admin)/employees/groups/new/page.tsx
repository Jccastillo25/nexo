import { createClient } from '@/lib/supabase/server'
import { JobPositionForm } from './job-form'

export default async function NewJobPositionPage() {
  const supabase = await createClient()

  const { data: companies } = await supabase.from('companies').select('id, display_name, legal_name, slug, tax_id, is_active').eq('is_active', true)
  const { data: positions } = await supabase.from('job_positions').select('id, name, code, level, parent_id, icon_name, is_active, company_id').eq('is_active', true)

  return (
    <section className="mx-auto max-w-2xl space-y-6 text-center">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Nuevo Puesto de Trabajo</h1>
        <p className="text-sm text-slate-500">Define las responsabilidades y jerarquía.</p>
      </div>

      <div className="rounded-3xl bg-white p-8 shadow-sm ring-1 ring-slate-200">
        <JobPositionForm 
          companies={companies || []} 
          existingPositions={positions || []} 
        />
      </div>
    </section>
  )
}
