'use client'

import React, { useState, useEffect } from 'react'
import { EmployeeStatusBadge, AttendanceStatus } from './EmployeeStatusBadge'
import { Shield, AlertTriangle } from 'lucide-react'

// ── Tipos ────────────────────────────────────────────────────────────────────

export interface Employee {
  id: string
  first_name: string
  last_name: string
  current_status: AttendanceStatus
  last_status_change: string   // ISO8601
  photo_url?: string | null
  job_positions?: { id: string; name: string; level: number; parent_id: string | null } | null
  company_id: string
  late_minutes?: number        // tardanza al entrar (opcional)
  shift_hours?: number         // duración del turno  (default: 8)
  break_minutes?: number       // duración del descanso (default: 60)
}

interface Props {
  employee: Employee
  onOpenDrawer: (employee: Employee) => void
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const AVATAR_PALETTE = [
  '#0d7ff2', // blue (primary)
  '#7c3aed', // violet
  '#059669', // emerald
  '#d97706', // amber
  '#0891b2', // cyan
  '#be185d', // pink
  '#65a30d', // lime
  '#dc2626', // red
]

function getAvatarColor(first: string, last: string): string {
  const hash = [...`${first}${last}`].reduce((acc, ch) => acc + ch.charCodeAt(0), 0)
  return AVATAR_PALETTE[hash % AVATAR_PALETTE.length]
}

function getInitials(first: string, last: string): string {
  return (((first || '').trim()[0] ?? '') + ((last || '').trim()[0] ?? '')).toUpperCase() || '?'
}

function formatElapsed(ms: number, withSeconds: boolean): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  if (withSeconds) {
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }
  if (h > 0) return `${h}h ${m.toString().padStart(2, '0')}m`
  return `${m}m`
}

// ── Estado visual efectivo ────────────────────────────────────────────────────

type EffectiveStatus = 'active' | 'on_break' | 'overtime' | 'break_alert' | 'offline' | 'absent'

interface CardVisual {
  wrapper: string        // clases del div exterior (borde gradiente)
  glowColor: string      // color del glow detrás del avatar
  dotClass: string       // indicador de estado en avatar
  progressBar: string    // clases de la barra de progreso
  progressLabel: string  // etiqueta encima de la barra
  badgeStatus: AttendanceStatus | string
  accentLine: string     // línea de color superior
}

const CARD_VISUAL: Record<EffectiveStatus, CardVisual> = {
  active: {
    wrapper: 'bg-[var(--border-soft)] hover:bg-emerald-500/20',
    glowColor: 'rgba(16,185,129,0.25)',
    dotClass: 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.9)]',
    progressBar: 'bg-gradient-to-r from-emerald-500 to-teal-400',
    progressLabel: 'Progreso de Jornada',
    badgeStatus: 'active',
    accentLine: 'bg-emerald-500/40',
  },
  overtime: {
    wrapper: 'bg-gradient-to-r from-violet-600/80 to-purple-600/80',
    glowColor: 'rgba(139,92,246,0.35)',
    dotClass: 'bg-violet-400 shadow-[0_0_8px_rgba(139,92,246,0.9)]',
    progressBar: 'bg-gradient-to-r from-violet-500 to-purple-400',
    progressLabel: 'Tiempo Extra Acumulado',
    badgeStatus: 'overtime',
    accentLine: 'bg-violet-500/60',
  },
  on_break: {
    wrapper: 'bg-[var(--border-soft)] hover:bg-amber-500/15',
    glowColor: 'rgba(245,158,11,0.25)',
    dotClass: 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.9)]',
    progressBar: 'bg-gradient-to-r from-amber-500 to-orange-400',
    progressLabel: 'Tiempo de Descanso',
    badgeStatus: 'on_break',
    accentLine: 'bg-amber-500/40',
  },
  break_alert: {
    wrapper: 'bg-gradient-to-r from-red-500 to-rose-600 animate-pulse',
    glowColor: 'rgba(239,68,68,0.35)',
    dotClass: 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.9)]',
    progressBar: 'bg-gradient-to-r from-red-500 to-rose-600',
    progressLabel: 'Descanso Excedido',
    badgeStatus: 'on_break',
    accentLine: 'bg-red-500',
  },
  offline: {
    wrapper: 'bg-[var(--border-soft)]/60',
    glowColor: 'rgba(100,116,139,0.15)',
    dotClass: 'bg-slate-500',
    progressBar: '',
    progressLabel: '',
    badgeStatus: 'offline',
    accentLine: 'bg-slate-700',
  },
  absent: {
    wrapper: 'bg-[var(--border-soft)]/60',
    glowColor: 'rgba(244,63,94,0.2)',
    dotClass: 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.6)]',
    progressBar: '',
    progressLabel: '',
    badgeStatus: 'absent',
    accentLine: 'bg-rose-500/40',
  },
}

// ── Componente ────────────────────────────────────────────────────────────────

export const EmployeeCard = ({ employee, onOpenDrawer }: Props) => {
  const [elapsedMs, setElapsedMs] = useState(0)

  const shiftMs    = (employee.shift_hours   ?? 8)  * 3_600_000
  const breakMs    = (employee.break_minutes ?? 60) * 60_000

  useEffect(() => {
    const tick = () => {
      const start = new Date(employee.last_status_change).getTime()
      setElapsedMs(Date.now() - start)
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [employee.last_status_change])

  // ── Cálculo de progreso y estado efectivo ────────────────────────────────
  let progress = 0
  let effectiveStatus: EffectiveStatus = employee.current_status as EffectiveStatus

  if (employee.current_status === 'active') {
    progress = (elapsedMs / shiftMs) * 100
    if (progress > 100) effectiveStatus = 'overtime'
  } else if (employee.current_status === 'on_break') {
    progress = (elapsedMs / breakMs) * 100
    if (progress >= 100) effectiveStatus = 'break_alert'
  }

  const visual       = CARD_VISUAL[effectiveStatus]
  const avatarColor  = getAvatarColor(employee.first_name, employee.last_name)
  const initials     = getInitials(employee.first_name, employee.last_name)
  const showProgress = employee.current_status === 'active' || employee.current_status === 'on_break'
  const isOffline    = employee.current_status === 'offline' || employee.current_status === 'absent'
  const isLate       = (employee.late_minutes ?? 0) > 0

  return (
    <div
      className={`group relative overflow-hidden rounded-[2rem] p-[1.5px] transition-all duration-200 hover:scale-[1.015] hover:shadow-xl ${visual.wrapper}`}
    >
      <div className="relative h-full w-full rounded-[1.95rem] bg-[var(--bg-app)] overflow-hidden">

        {/* Línea de acento superior */}
        <div className={`absolute top-0 left-0 right-0 h-[2px] ${visual.accentLine}`} />

        {/* Fondo con glow suave del status */}
        <div
          className="absolute -right-6 -top-6 h-28 w-28 rounded-full blur-3xl opacity-60 transition-opacity group-hover:opacity-90 pointer-events-none"
          style={{ background: visual.glowColor }}
        />

        <div className="relative p-5 space-y-4">

          {/* ── Fila superior: Avatar + Nombre + Badge ── */}
          <div className="flex items-start justify-between gap-3">

            {/* Avatar */}
            <div className="relative shrink-0">
              {/* Glow animado detrás */}
              <div
                className="absolute -inset-1 rounded-2xl blur-md opacity-30 group-hover:opacity-50 transition-opacity"
                style={{ background: visual.glowColor }}
              />
              <div
                className="relative flex h-13 w-13 items-center justify-center rounded-2xl ring-1 ring-white/10 overflow-hidden"
                style={{ width: 52, height: 52, background: employee.photo_url ? 'transparent' : avatarColor + '22' }}
              >
                {employee.photo_url ? (
                  <img
                    src={employee.photo_url}
                    alt={`${employee.first_name} ${employee.last_name}`}
                    className="h-full w-full object-cover"
                    onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
                  />
                ) : (
                  <span
                    className="text-base font-black select-none"
                    style={{ color: avatarColor }}
                  >
                    {initials}
                  </span>
                )}
              </div>
              {/* Dot de estado */}
              <div
                className={`absolute -right-1 -bottom-1 h-3.5 w-3.5 rounded-full border-2 border-[var(--bg-app)] ${visual.dotClass}`}
              />
            </div>

            {/* Nombre y cargo */}
            <div className="flex-1 min-w-0 space-y-1 mt-0.5">
              <h3 className="text-[15px] font-black tracking-tight leading-tight truncate text-white group-hover:text-blue-100 transition-colors">
                {employee.first_name} {employee.last_name}
              </h3>
              <div className="flex items-center gap-1.5 flex-wrap">
                <span
                  className="text-[10px] font-semibold uppercase tracking-widest flex items-center gap-1"
                  style={{ color: 'var(--text-muted)' }}
                >
                  <Shield size={9} style={{ color: avatarColor, opacity: 0.7 }} />
                  {employee.job_positions?.name || 'Operativo'}
                </span>
                {isLate && (
                  <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-wider text-orange-400 bg-orange-500/10 ring-1 ring-orange-500/20 rounded-full px-1.5 py-0.5">
                    <AlertTriangle size={8} />
                    +{employee.late_minutes}m tarde
                  </span>
                )}
              </div>
            </div>

            {/* Badge de estado */}
            <div className="shrink-0">
              <EmployeeStatusBadge status={visual.badgeStatus} />
            </div>
          </div>

          {/* ── Temporizador ── */}
          <div
            className="flex items-center justify-between rounded-xl px-3.5 py-2.5"
            style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-soft)' }}
          >
            <span className="section-label">
              {employee.current_status === 'active'    ? 'Tiempo en turno' :
               employee.current_status === 'on_break'  ? 'Tiempo en descanso' :
               employee.current_status === 'absent'    ? 'Ausente' : 'Fuera de turno'}
            </span>
            <span
              className="font-mono text-sm font-black tabular-nums tracking-tight"
              style={{
                color: effectiveStatus === 'overtime'    ? '#a78bfa' :
                       effectiveStatus === 'break_alert' ? '#f87171' :
                       effectiveStatus === 'on_break'    ? '#fbbf24' :
                       effectiveStatus === 'active'      ? '#34d399' :
                       'var(--text-muted)',
              }}
            >
              {isOffline
                ? '—'
                : formatElapsed(elapsedMs, employee.current_status === 'active')}
            </span>
          </div>

          {/* ── Barra de progreso ── */}
          {showProgress && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="section-label">{visual.progressLabel}</span>
                <span
                  className="text-[10px] font-black tabular-nums"
                  style={{
                    color: effectiveStatus === 'overtime'    ? '#a78bfa' :
                           effectiveStatus === 'break_alert' ? '#f87171' :
                           effectiveStatus === 'on_break'    ? '#fbbf24' : '#34d399',
                  }}
                >
                  {effectiveStatus === 'overtime'
                    ? `+${Math.round(progress - 100)}%`
                    : `${Math.min(100, Math.round(progress))}%`}
                </span>
              </div>

              {/* Track */}
              <div
                className="h-2 w-full overflow-hidden rounded-full"
                style={{ background: 'var(--bg-elevated)', boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.4)' }}
              >
                <div
                  className={`h-full rounded-full transition-all duration-1000 ease-out ${visual.progressBar}`}
                  style={{ width: `${Math.min(100, progress)}%` }}
                />
              </div>

              {/* Alerta de descanso excedido */}
              {effectiveStatus === 'break_alert' && (
                <p className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-tight text-red-400">
                  <AlertTriangle size={10} className="shrink-0" />
                  Límite de descanso superado
                </p>
              )}

              {/* Alerta de tiempo extra */}
              {effectiveStatus === 'overtime' && (
                <p className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-tight text-violet-400">
                  <AlertTriangle size={10} className="shrink-0" />
                  Turno extendido — {Math.round(elapsedMs / 3_600_000 - (employee.shift_hours ?? 8))}h extra
                </p>
              )}
            </div>
          )}

          {/* ── Botón de acción ── */}
          <button
            onClick={() => onOpenDrawer(employee)}
            className="w-full rounded-2xl py-2.5 text-[10px] font-black uppercase tracking-[0.2em] transition-all duration-200 ring-1 ring-white/8"
            style={{ background: 'var(--bg-surface)', color: 'var(--text-muted)' }}
            onMouseEnter={e => {
              e.currentTarget.style.background = 'var(--primary)'
              e.currentTarget.style.color = '#ffffff'
              e.currentTarget.style.boxShadow = '0 0 16px var(--primary-soft)'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'var(--bg-surface)'
              e.currentTarget.style.color = 'var(--text-muted)'
              e.currentTarget.style.boxShadow = ''
            }}
          >
            Acciones Rápidas
          </button>

        </div>
      </div>
    </div>
  )
}
