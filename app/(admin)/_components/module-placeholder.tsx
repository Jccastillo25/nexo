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
      <div className="rounded-2xl bg-white p-6" style={{ border: '1px solid var(--border-soft)' }}>
        <p className="text-xs font-bold uppercase tracking-[0.2em]" style={{ color: 'var(--text-light)' }}>
          Módulo
        </p>
        <h1 className="mt-2 text-3xl font-bold" style={{ color: 'var(--text-strong)' }}>{title}</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6" style={{ color: 'var(--text-muted)' }}>
          {description}
        </p>
      </div>

      {stats.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="rounded-2xl bg-white p-5"
              style={{ border: '1px solid var(--border-soft)' }}
            >
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{stat.label}</p>
              <p className="mt-3 text-3xl font-bold" style={{ color: 'var(--text-strong)' }}>{stat.value}</p>
            </div>
          ))}
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
        <div className="rounded-2xl bg-white p-6" style={{ border: '1px solid var(--border-soft)' }}>
          <h2 className="text-lg font-semibold" style={{ color: 'var(--text-strong)' }}>
            Vista base del módulo
          </h2>
          <div
            className="mt-5 rounded-xl border border-dashed p-8 text-sm"
            style={{ borderColor: 'var(--border-medium)', background: 'var(--bg-app)', color: 'var(--text-muted)' }}
          >
            Aquí irá la tabla, gráfico o formulario principal de este módulo.
          </div>
        </div>

        <div className="rounded-2xl bg-white p-6" style={{ border: '1px solid var(--border-soft)' }}>
          <h2 className="text-lg font-semibold" style={{ color: 'var(--text-strong)' }}>
            Próximos componentes
          </h2>
          <ul className="mt-4 space-y-3 text-sm" style={{ color: 'var(--text-muted)' }}>
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
