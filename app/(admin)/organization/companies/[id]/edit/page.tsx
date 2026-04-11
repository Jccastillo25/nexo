import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import EditCompanyForm from './EditCompanyForm'

interface EditCompanyPageProps {
  params: {
    id: string
  }
}

export default async function EditCompanyPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const { data: company, error } = await supabase
    .from('companies')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !company) {
    notFound()
  }

  return (
    <section className="space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href="/organization/companies"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-800 border border-slate-700 text-slate-400 shadow-sm transition hover:bg-slate-700 hover:text-white"
        >
          ←
        </Link>
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight">Editar Empresa</h1>
          <p className="mt-1 text-sm text-slate-400">
            Modifica la información de <span className="font-bold text-white leading-relaxed">{company.display_name}</span>
          </p>
        </div>
      </div>

      <EditCompanyForm company={company} />
    </section>
  )
}
