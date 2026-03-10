import Link from 'next/link'

const reportCards = [
  {
    title: 'Asistencia diaria',
    desc: 'Resumen de entradas, salidas y tardanzas por día y sucursal.',
    badge: 'Próximamente',
    href: '#',
  },
  {
    title: 'Horas trabajadas',
    desc: 'Total de horas por empleado en un rango de fechas seleccionado.',
    badge: 'Próximamente',
    href: '#',
  },
  {
    title: 'Tardanzas y ausencias',
    desc: 'Detalle de incidencias por empleado con descripción de cada evento.',
    badge: 'Próximamente',
    href: '#',
  },
  {
    title: 'Permisos y vacaciones',
    desc: 'Estado de solicitudes aprobadas, rechazadas y pendientes.',
    badge: 'Próximamente',
    href: '#',
  },
  {
    title: 'Cierre de período',
    desc: 'Resumen consolidado listo para nómina al cierre del período.',
    badge: 'Próximamente',
    href: '#',
  },
  {
    title: 'Auditoría del sistema',
    desc: 'Registro de acciones administrativas y cambios de configuración.',
    badge: 'Próximamente',
    href: '/security',
  },
]

export default function ReportsPage() {
  return (
    <section className="space-y-6">

      <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-400">Análisis</p>
        <h1 className="mt-2 text-3xl font-bold text-slate-900">Reportes</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
          Centro de reportes para asistencia, tardanzas, horas trabajadas y exportaciones.
          Los reportes estarán disponibles en la siguiente fase del sistema.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {reportCards.map((r) => (
          <div
            key={r.title}
            className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200"
          >
            <div className="flex items-start justify-between">
              <h2 className="text-base font-semibold text-slate-900">{r.title}</h2>
              <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-500">
                {r.badge}
              </span>
            </div>
            <p className="mt-3 text-sm text-slate-500">{r.desc}</p>
            {r.href !== '#' && (
              <Link
                href={r.href}
                className="mt-4 inline-block text-xs font-semibold text-slate-500 underline-offset-2 hover:underline"
              >
                Ver ahora →
              </Link>
            )}
          </div>
        ))}
      </div>

      <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-center">
        <p className="text-sm font-semibold text-slate-500">
          Los reportes con exportación a PDF y Excel estarán disponibles en la próxima versión.
        </p>
        <p className="mt-2 text-xs text-slate-400">
          Por ahora, puedes consultar registros en tiempo real desde los módulos de Asistencia y Permisos.
        </p>
        <Link
          href="/attendance/records"
          className="mt-4 inline-block rounded-2xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
        >
          Ver registros de asistencia
        </Link>
      </div>

    </section>
  )
}
