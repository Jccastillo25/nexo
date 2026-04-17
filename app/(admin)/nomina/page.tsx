import Link from 'next/link'
import { PlanillaView } from './_views/planilla-view'
import { CierresView } from './_views/cierres-view'
import { DetalleView } from './_views/detalle-view'

interface NominaPageProps {
  searchParams: Promise<{
    tab?: string
    start?: string
    end?: string
    branch?: string
    employee?: string
  }>
}

const TABS = [
  { id: 'planilla',  label: 'Planilla de Nómina' },
  { id: 'cierres',   label: 'Cierres de Período' },
  { id: 'detalle',   label: 'Detalle por Empleado' },
]

export default async function NominaPage({ searchParams }: NominaPageProps) {
  const params = await searchParams
  const activeTab = params.tab || 'planilla'

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 border-b border-slate-700/50 pb-4 md:flex-row md:items-end md:justify-between px-2">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Módulo</p>
          <h1 className="text-2xl font-black tracking-tight text-white">Nómina y Cierres</h1>
          <p className="mt-1 text-sm text-slate-400">Planillas, cálculo salarial y cierres de período.</p>
        </div>
        <nav className="flex space-x-2 shrink-0 overflow-x-auto pb-2 md:pb-0">
          {TABS.map((tab) => {
            const isActive = activeTab === tab.id
            return (
              <Link
                key={tab.id}
                href={`/nomina?tab=${tab.id}&start=${params.start || ''}&end=${params.end || ''}&branch=${params.branch || ''}`}
                className={`rounded-full px-5 py-2 text-[11px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${
                  isActive
                    ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/20'
                    : 'bg-slate-800 border border-slate-700 text-slate-400 hover:bg-slate-700 hover:text-white'
                }`}
              >
                {tab.label}
              </Link>
            )
          })}
        </nav>
      </div>

      <div className="w-full">
        {activeTab === 'planilla' && (
          <PlanillaView start={params.start} end={params.end} branch={params.branch} />
        )}
        {activeTab === 'cierres' && (
          <CierresView />
        )}
        {activeTab === 'detalle' && (
          <DetalleView start={params.start} end={params.end} employee={params.employee} />
        )}
      </div>
    </div>
  )
}
