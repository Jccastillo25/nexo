'use client'

import React from 'react'

export type AttendanceStatus = 'active' | 'on_break' | 'offline' | 'absent' | 'overtime'

interface Props {
  status: AttendanceStatus | string
  className?: string
}

interface StatusConfig {
  label: string
  color: string
  dot: string
  shadow: string
  pulse: boolean
}

const STATUS_CONFIG: Record<string, StatusConfig> = {
  active: {
    label: 'En Línea',
    color: 'bg-emerald-500/10 text-emerald-400 ring-emerald-500/20',
    dot: 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]',
    shadow: 'shadow-[0_0_15px_rgba(52,211,153,0.1)]',
    pulse: true,
  },
  on_break: {
    label: 'En Descanso',
    color: 'bg-amber-500/10 text-amber-400 ring-amber-500/20',
    dot: 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.6)]',
    shadow: 'shadow-[0_0_15px_rgba(251,191,36,0.1)]',
    pulse: true,
  },
  overtime: {
    label: 'Tiempo Extra',
    color: 'bg-violet-500/10 text-violet-400 ring-violet-500/20',
    dot: 'bg-violet-400 shadow-[0_0_8px_rgba(167,139,250,0.6)]',
    shadow: 'shadow-[0_0_15px_rgba(167,139,250,0.15)]',
    pulse: true,
  },
  offline: {
    label: 'Desconectado',
    color: 'bg-slate-500/10 text-slate-400 ring-slate-500/20',
    dot: 'bg-slate-500',
    shadow: '',
    pulse: false,
  },
  absent: {
    label: 'Ausencia',
    color: 'bg-rose-500/10 text-rose-400 ring-rose-500/20',
    dot: 'bg-rose-400 shadow-[0_0_8px_rgba(244,63,94,0.6)]',
    shadow: 'shadow-[0_0_15px_rgba(244,63,94,0.1)]',
    pulse: false,
  },
}

export const EmployeeStatusBadge = ({ status, className = '' }: Props) => {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.offline

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ring-1 ring-inset ${cfg.color} ${cfg.shadow} ${className}`}
      role="status"
      aria-label={cfg.label}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${cfg.dot} ${cfg.pulse ? 'animate-pulse' : ''}`}
        aria-hidden="true"
      />
      {cfg.label}
    </span>
  )
}
