'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const titles: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/attendance': 'Asistencia',
  '/attendance/records': 'Registros',
  '/attendance/corrections': 'Correcciones',
  '/attendance/incidents': 'Incidencias',
  '/employees': 'Empleados',
  '/schedules': 'Horarios',
  '/schedules/assignments': 'Asignaciones de turnos',
  '/leave': 'Permisos y ausencias',
  '/reports': 'Reportes',
  '/organization': 'Organización',
  '/organization/companies': 'Empresas',
  '/organization/branches': 'Sucursales',
  '/organization/memberships': 'Membresías',
  '/security': 'Seguridad',
  '/settings': 'Configuración',
}

export function AdminTopbar() {
  const pathname = usePathname()

  const currentTitle =
    Object.entries(titles).find(([key]) => pathname === key || pathname.startsWith(`${key}/`))?.[1] ??
    'Panel'

  return (
    <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="flex items-center justify-between gap-4 px-5 py-3">

        {/* Izquierda: título de página */}
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-bold text-slate-900">{currentTitle}</h2>
        </div>

        {/* Derecha: Buscador + Modo Kiosco + campana */}
        <div className="flex items-center gap-2">
          {/* Buscador */}
          <div className="relative hidden md:block">
            <input
              type="text"
              placeholder="Buscar empleados, reportes..."
              className="h-9 w-56 rounded-full border border-slate-200 bg-slate-50 pl-9 pr-4 text-sm outline-none transition focus:border-blue-300 focus:ring-2 focus:ring-blue-50 lg:w-72"
            />
            <svg className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
            </svg>
          </div>

          {/* Botón Modo Kiosco */}
          <Link
            href="/"
            className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="3" width="20" height="14" rx="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" />
            </svg>
            Modo Kiosco
          </Link>

          {/* Campana */}
          <button
            className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50"
            title="Notificaciones"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
          </button>
        </div>
      </div>
    </header>
  )
}
