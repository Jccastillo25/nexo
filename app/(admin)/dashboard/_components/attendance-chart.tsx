'use client'

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'

const data = [
  { name: 'Lun', total: 1000, value: 600 },
  { name: 'Mar', total: 1000, value: 620 },
  { name: 'Mie', total: 1000, value: 680 },
  { name: 'Jue', total: 1000, value: 610 },
  { name: 'Vie', total: 1000, value: 720 },
  { name: 'Sab', total: 1000, value: 450 },
  { name: 'Dom', total: 1000, value: 380 },
]

export function AttendanceChart() {
  return (
    <div className="h-[350px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 20, right: 0, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-soft)" />
          <XAxis 
            dataKey="name" 
            axisLine={false} 
            tickLine={false} 
            tick={{ fill: 'var(--text-muted)', fontSize: 12 }}
            dy={10}
          />
          <YAxis 
            axisLine={false} 
            tickLine={false} 
            tick={{ fill: 'var(--text-muted)', fontSize: 12 }}
            dx={-10}
          />
          <Tooltip 
            cursor={{ fill: 'var(--primary-softer)' }}
            contentStyle={{ 
              backgroundColor: 'var(--bg-surface)', 
              border: '1px solid var(--border-soft)',
              borderRadius: '12px',
              color: 'var(--text-strong)'
            }}
          />
          {/* Background Bar (Total) */}
          <Bar dataKey="total" fill="var(--primary-softer)" radius={[10, 10, 0, 0]} barSize={40} />
          {/* Active Bar (Value) */}
          <Bar dataKey="value" fill="var(--primary)" radius={[10, 10, 0, 0]} barSize={40} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
