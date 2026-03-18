'use client'

export function TopDelaysChart({ delays }: { delays: { name: string; minutes: number; color: string }[] }) {
  if (!delays || delays.length === 0) {
    return <div className="text-center py-10 text-xs text-slate-500">Sin datos de atrasos este mes.</div>
  }
  const maxMins = Math.max(...delays.map(d => d.minutes), 60)
  return (
    <div className="space-y-6">
      {delays.map((item, i) => (
        <div key={i} className="space-y-2">
          <div className="flex justify-between text-xs font-bold uppercase tracking-tight">
            <span style={{ color: 'var(--text-body)' }}>{item.name}</span>
            <span style={{ color: item.color }}>{item.minutes} min</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
            <div 
              className="h-full rounded-full transition-all duration-1000"
              style={{ 
                width: `${(item.minutes / maxMins) * 100}%`,
                backgroundColor: item.color,
                boxShadow: `0 0 10px ${item.color}44`
              }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}
