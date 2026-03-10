const stats = [
  { label: 'Empleados activos', value: '128' },
  { label: 'Presentes hoy', value: '94' },
  { label: 'Ausentes hoy', value: '11' },
  { label: 'Correcciones pendientes', value: '7' },
]

const recentItems = [
  'Marcación registrada — Julio Pérez — 08:01 a. m.',
  'Corrección pendiente — Ana López — 07:45 a. m.',
  'Nueva solicitud de permiso — Karen Ruiz',
  'Tardanza detectada — José Castillo',
]

const quickActions = [
  'Nuevo empleado',
  'Nueva corrección',
  'Crear turno',
  'Exportar reporte',
]

export default function DashboardPage() {
  return (
    <section className="space-y-6">
      <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-400">
          Dashboard
        </p>
        <h1 className="mt-2 text-3xl font-bold text-slate-900">
          Resumen general del sistema
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
          Vista ejecutiva para monitorear asistencia, incidencias, solicitudes y
          actividad reciente de la operación.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200"
          >
            <p className="text-sm text-slate-500">{stat.label}</p>
            <p className="mt-3 text-3xl font-bold text-slate-900">{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.5fr_1fr]">
        <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">
              Asistencia semanal
            </h2>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
              Placeholder
            </span>
          </div>

          <div className="mt-6 grid h-72 place-items-center rounded-2xl bg-slate-50 text-sm text-slate-400">
            Aquí irá el gráfico principal
          </div>
        </div>

        <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <h2 className="text-lg font-semibold text-slate-900">
            Actividad reciente
          </h2>

          <div className="mt-5 space-y-3">
            {recentItems.map((item) => (
              <div
                key={item}
                className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600"
              >
                {item}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {quickActions.map((action) => (
          <button
            key={action}
            className="rounded-3xl bg-slate-900 px-5 py-6 text-left text-white transition hover:bg-slate-800"
          >
            <p className="text-sm text-white/70">Acción rápida</p>
            <p className="mt-2 text-lg font-semibold">{action}</p>
          </button>
        ))}
      </div>
    </section>
  )
}
