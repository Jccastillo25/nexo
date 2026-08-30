import Link from 'next/link'
import { CompanyForm } from './company-form'

export default function NewCompanyPage() {
  return (
    <section className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href="/organization/companies"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-800 border border-slate-700 text-slate-400 shadow-sm transition hover:bg-slate-700 hover:text-white"
        >
          ←
        </Link>
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight">Nueva Empresa</h1>
          <p className="mt-1 text-sm text-slate-400">Registra una nueva entidad en el sistema.</p>
        </div>
      </div>

      <div className="app-surface p-6 sm:p-8">
        <CompanyForm />
      </div>
    </section>
  )
}
