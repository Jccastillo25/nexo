import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import EditCompanyForm from './EditCompanyForm'

interface EditCompanyPageProps {
  params: {
    id: string
  }
}

export default async function EditCompanyPage({ params }: EditCompanyPageProps) {
  const supabase = await createClient()

  const { data: company, error } = await supabase
    .from('companies')
    .select('*')
    .eq('id', params.id)
    .single()

  if (error || !company) {
    notFound()
  }

  return (
    <section className="space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href="/organization/companies"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-slate-200 transition hover:bg-slate-50"
        >
          <span className="text-lg">←</span>
        </Link>
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Editar Empresa</h1>
          <p className="mt-1 text-sm text-slate-500">
            Modifica la información de {company.display_name}
          </p>
        </div>
      </div>

      <EditCompanyForm company={company} />
    </section>
  )
}
