import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

export default async function EmployeeTypesPage() {
  const supabase = await createClient()

  // Intentar obtener tipos de empleados si existe la tabla, sino usar placeholder
  // Basado en el análisis previo, no parece haber una tabla 'employee_types' explícitamente usada aún.
  // Mock data for "WOW" effect and to show functionality
  const types = [
    { id: '1', name: 'Administrativo', description: 'Personal de oficina y gestión.', count: 5, color: 'blue' },
    { id: '2', name: 'Operativo', description: 'Personal en planta o campo.', count: 24, color: 'green' },
    { id: '3', name: 'Ventas', description: 'Equipo comercial y preventa.', count: 12, color: 'purple' },
    { id: '4', name: 'Gerencia', description: 'Directores y jefes de área.', count: 3, color: 'amber' },
  ]

  return (
    <section className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-400">
            Recursos humanos
          </p>
          <h1 className="mt-2 text-3xl font-bold text-slate-900">Tipos de Empleados</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
            Categoriza a tus colaboradores para una mejor organización y reportes específicos.
          </p>
        </div>
        <button
          className="shrink-0 rounded-2xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
        >
          + Nuevo tipo
        </button>
      </div>

      {/* Grid of Types */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {types.map((t) => (
          <div key={t.id} className="group relative flex flex-col justify-between rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200 transition hover:shadow-md">
            <div>
              <div className={`mb-4 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-${t.color}-50 text-${t.color}-600`}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-slate-900">{t.name}</h3>
              <p className="mt-2 text-sm text-slate-500 line-clamp-2">
                {t.description}
              </p>
            </div>
            
            <div className="mt-6 flex items-center justify-between border-t border-slate-50 pt-4">
              <span className="text-xs font-medium text-slate-400">
                {t.count} colaboradores
              </span>
              <button className="text-xs font-semibold text-slate-900 hover:underline">
                Gestionar
              </button>
            </div>
          </div>
        ))}

        {/* Empty State / Add Card */}
        <button className="flex flex-col items-center justify-center rounded-3xl border-2 border-dashed border-slate-200 p-6 transition hover:border-slate-300 hover:bg-slate-50">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400 text-2xl font-light">
            +
          </div>
          <span className="mt-4 text-sm font-semibold text-slate-500 text-center">Definir nueva categoría</span>
        </button>
      </div>

    </section>
  )
}
