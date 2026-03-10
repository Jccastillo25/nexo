type ModulePlaceholderProps = {
  title: string
  description: string
  stats?: Array<{ label: string; value: string }>
  bullets?: string[]
}

export function ModulePlaceholder({
  title,
  description,
  stats = [],
  bullets = [],
}: ModulePlaceholderProps) {
  return (
    <section className="space-y-6">
      <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-400">
          Módulo
        </p>
        <h1 className="mt-2 text-3xl font-bold text-slate-900">{title}</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
          {description}
        </p>
      </div>

      {stats.length > 0 && (
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
      )}

      <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
        <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <h2 className="text-lg font-semibold text-slate-900">
            Vista base del módulo
          </h2>

          <div className="mt-5 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-sm text-slate-500">
            Aquí irá la tabla, gráfico o formulario principal de este módulo.
          </div>
        </div>

        <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <h2 className="text-lg font-semibold text-slate-900">
            Próximos componentes
          </h2>

          <ul className="mt-4 space-y-3 text-sm text-slate-600">
            {(bullets.length > 0 ? bullets : [
              'filtros avanzados',
              'badges de estado',
              'tabla con acciones',
              'drawer de detalle',
              'exportaciones',
            ]).map((bullet) => (
              <li key={bullet}>• {bullet}</li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}
