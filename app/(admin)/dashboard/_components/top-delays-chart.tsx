'use client'

const delays = [
  { name: 'Juan Perez (Bodega)', minutes: 120, color: '#ef4444' },
  { name: 'Maria Garcia (Ventas)', minutes: 85, color: '#f59e0b' },
  { name: 'Luis Castro (IT)', minutes: 42, color: '#fcd34d' },
]

export function TopDelaysChart() {
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
                width: `${(item.minutes / 130) * 100}%`,
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
