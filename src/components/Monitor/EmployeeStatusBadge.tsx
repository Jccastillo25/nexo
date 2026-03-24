import React from 'react'

export type AttendanceStatus = 'active' | 'on_break' | 'offline' | 'absent'

interface Props {
  status: AttendanceStatus | string
  className?: string
}

export const EmployeeStatusBadge = ({ status, className = '' }: Props) => {
  const config: Record<string, { label: string; color: string; dot: string }> = {
    active: { 
      label: 'Activo', 
      color: 'bg-green-100 text-green-700 ring-green-600/20',
      dot: 'bg-green-500'
    },
    on_break: { 
      label: 'En Descanso', 
      color: 'bg-amber-100 text-amber-700 ring-amber-600/20',
      dot: 'bg-amber-500'
    },
    offline: { 
      label: 'Fuera', 
      color: 'bg-slate-100 text-slate-600 ring-slate-600/10',
      dot: 'bg-slate-400'
    },
    absent: { 
      label: 'Ausente', 
      color: 'bg-red-100 text-red-700 ring-red-600/20',
      dot: 'bg-red-500'
    }
  }

  const { label, color, dot } = config[status] || config.offline

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-xs font-medium ring-1 ring-inset ${color} ${className}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${dot}`} aria-hidden="true" />
      {label}
    </span>
  )
}
