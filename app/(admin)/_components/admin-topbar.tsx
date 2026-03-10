'use client'

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
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-4 py-4 md:px-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
            SaaS RRHH
          </p>
          <h2 className="mt-1 text-xl font-bold text-slate-900">{currentTitle}</h2>
        </div>

        <div className="flex items-center gap-3">
          <input
            type="text"
            placeholder="Buscar..."
            className="hidden h-11 w-64 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none transition focus:border-slate-300 md:block"
          />

          <button className="rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800">
            Acción rápida
          </button>
        </div>
      </div>
    </header>
  )
}
