import Link from 'next/link'
import { AttendanceView } from './_views/attendance-view'
import { HoursView } from './_views/hours-view'
import { IncidentsView } from './_views/incidents-view'

interface ReportsHubProps {
  searchParams: Promise<{
    type?: string
    start?: string
    end?: string
    date?: string
    branch?: string
    employee?: string
  }>
}

const TABS = [
  { id: 'hours', label: 'Horas Trabajadas', default: true },
  { id: 'attendance', label: 'Asistencia Diaria' },
  { id: 'incidents', label: 'Tardanzas y Ausencias' },
]

export default async function ReportsHubPage({ searchParams }: ReportsHubProps) {
  const params = await searchParams
  const activeTab = params.type || 'hours'

  // Pass current filters so tabs can persist them (if needed in a more complex setup)
  const queryStr = `?start=${params.start || ''}&end=${params.end || ''}&date=${params.date || ''}&branch=${params.branch || ''}&employee=${params.employee || ''}`

  return (
    <div className="space-y-6">
      {/* Universal Tab Navigation */}
      <div className="flex flex-col gap-4 border-b border-slate-200 pb-2 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Centro de Reportes y Nómina</h1>
          <p className="mt-1 text-sm text-slate-500">
            Hub unificado para exportación de datos y cálculos horariales.
          </p>
        </div>
        
        <nav className="flex space-x-2 shrink-0 overflow-x-auto pb-2 md:pb-0">
          {TABS.map((tab) => {
            const isActive = activeTab === tab.id
            return (
              <Link
                key={tab.id}
                href={`/reports?type=${tab.id}&start=${params.start || ''}&end=${params.end || ''}&date=${params.date || ''}&branch=${params.branch || ''}`}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors whitespace-nowrap ${
                  isActive
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {tab.label}
              </Link>
            )
          })}
        </nav>
      </div>

      {/* Render Active View */}
      <div className="w-full">
        {activeTab === 'hours' && (
          <HoursView start={params.start} end={params.end} branch={params.branch} />
        )}
        {activeTab === 'attendance' && (
          <AttendanceView date={params.date} branch={params.branch} />
        )}
        {activeTab === 'incidents' && (
          <IncidentsView start={params.start} end={params.end} employee={params.employee} />
        )}
      </div>
    </div>
  )
}
