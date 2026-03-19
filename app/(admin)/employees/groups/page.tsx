import Link from 'next/link'

export default function GroupsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-400">Empleados</p>
          <h1 className="mt-2 text-3xl font-bold text-slate-900">Grupos y Equipos</h1>
          <p className="mt-2 text-sm text-slate-500">Organiza a tus colaboradores por sucursales o proyectos.</p>
        </div>
      </div>

      <div className="rounded-3xl border-2 border-dashed border-slate-200 bg-white p-12 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-slate-50 text-slate-400">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
        </div>
        <h2 className="mt-4 text-lg font-bold text-slate-900">Módulo en construcción</h2>
        <p className="mt-2 text-sm text-slate-500">Próximamente podrás gestionar equipos y jerarquías desde aquí.</p>
        <Link href="/employees" className="mt-6 inline-block rounded-xl bg-slate-900 px-6 py-2 text-sm font-semibold text-white">
          Volver al directorio
        </Link>
      </div>
    </div>
  )
}
