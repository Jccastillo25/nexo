'use client'

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'

const data = [
  { name: 'Presentes', value: 1092, color: 'var(--primary)' },
  { name: 'Ausentes', value: 192, color: 'var(--bg-app)' },
]

export function AttendanceDonut() {
  return (
    <div className="h-[200px] w-full flex items-center justify-center relative">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={80}
            paddingAngle={5}
            dataKey="value"
            stroke="none"
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip 
            contentStyle={{ 
              backgroundColor: 'var(--bg-surface)', 
              border: '1px solid var(--border-soft)',
              borderRadius: '12px'
            }}
          />
        </PieChart>
      </ResponsiveContainer>
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <span className="text-2xl font-black text-white">85%</span>
        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest text-center leading-tight">Asistencia<br/>Actual</span>
      </div>
    </div>
  )
}
