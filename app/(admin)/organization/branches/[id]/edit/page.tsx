import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { BranchEditForm } from './branch-edit-form'

export default async function EditBranchPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const { data: branch, error } = await supabase
    .from('branches')
    .select('*, companies(id, display_name, slug)')
    .eq('id', id)
    .single()

  if (error || !branch) {
    notFound()
  }

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
          className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-slate-500 shadow-sm ring-1 ring-slate-200 transition hover:bg-slate-50 hover:text-slate-900"
        >
          ←
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Editar sucursal</h1>
          <p className="text-sm text-slate-500">Modifica los detalles de la sucursal {branch.name}.</p>
        </div>
      </div>

      <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200 sm:p-8">
        <BranchEditForm branch={branch} companies={companies ?? []} />
      </div>
    </section>
  )
}
