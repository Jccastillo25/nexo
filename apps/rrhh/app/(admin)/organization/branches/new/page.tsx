import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { BranchForm } from './branch-form'

export default async function NewBranchPage() {
  const supabase = await createClient()

  const { data: companies } = await supabase
    .from('companies')
    .select('id, display_name, slug')
    .eq('is_active', true)
    .order('display_name')

  return (
    <section className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href="/organization/branches"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-800 border border-slate-700 text-slate-400 shadow-sm transition hover:bg-slate-700 hover:text-white"
        >
          ←
        </Link>
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight">Nueva sucursal</h1>
          <p className="mt-1 text-sm text-slate-400">Crea un nuevo punto de operación u oficina.</p>
        </div>
      </div>

      <div className="app-surface p-6 sm:p-8">
        <BranchForm companies={companies ?? []} />
      </div>
    </section>
  )
}
