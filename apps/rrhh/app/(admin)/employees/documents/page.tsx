import Link from 'next/link'

export default function DocumentsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-400">Empleados</p>
          <h1 className="mt-2 text-3xl font-bold text-slate-900">Documentos del Personal</h1>
          <p className="mt-2 text-sm text-slate-500">Gestión de contratos, identificaciones y expedientes digitales.</p>
        </div>
      </div>

      <div className="rounded-3xl border-2 border-dashed border-slate-200 bg-white p-12 text-center text-slate-500">
        Próximamente... Repositorio central de documentos por colaborador.
      </div>
    </div>
  )
}
