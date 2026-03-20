import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Briefcase, Plus, ChevronRight, TreePine } from 'lucide-react'

export default async function JobPositionsPage() {
  const supabase = await createClient()

  const { data: positions } = await supabase
    .from('job_positions')
    .select('*, companies(display_name)')
    .order('level', { ascending: true })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Puestos de Trabajo</h1>
          <p className="text-sm text-slate-500">Define la jerarquía y reglas de descanso de la organización.</p>
        </div>
        <Link 
          href="/employees/groups/new"
          className="flex h-11 items-center gap-2 rounded-2xl bg-slate-900 px-6 text-sm font-bold text-white shadow-lg transition hover:bg-slate-800 active:scale-95"
        >
          <Plus className="h-4 w-4" />
          Nuevo Puesto
        </Link>
      </div>

      <div className="grid gap-4">
        {!positions || positions.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-3xl border-2 border-dashed border-slate-200 bg-white p-12 text-center">
            <div className="mb-4 rounded-full bg-slate-50 p-4">
              <TreePine className="h-8 w-8 text-slate-400" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">No hay puestos definidos</h3>
            <p className="mx-auto mt-2 max-w-xs text-sm text-slate-500">
              Comienza creando los puestos de nivel 1 (Gerencia) para construir el organigrama.
            </p>
          </div>
        ) : (
          positions.map((job) => (
            <div 
              key={job.id}
              className="group flex items-center justify-between rounded-3xl border-2 border-slate-100 bg-white p-5 transition hover:border-slate-900 hover:shadow-xl"
            >
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-50 text-slate-400 transition group-hover:bg-slate-900 group-hover:text-white">
                  <Briefcase className="h-6 w-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-slate-900">{job.name}</h3>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500">
                      Nivel {job.level}
                    </span>
                  </div>
                  <p className="text-xs font-medium text-slate-500">
                    {job.companies?.display_name} • {job.default_break_mins} min descanso
                  </p>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-slate-300 transition group-hover:translate-x-1 group-hover:text-slate-900" />
            </div>
          ))
        )}
      </div>
    </div>
  )
}
