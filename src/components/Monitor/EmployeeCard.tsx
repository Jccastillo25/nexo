'use client'

import React, { useState, useEffect } from 'react'
import { EmployeeStatusBadge } from './EmployeeStatusBadge'
import { MoreHorizontal, User, Clock, Shield, Zap } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'

interface Props {
  employee: any
  onOpenDrawer: (employee: any) => void
}

export const EmployeeCard = ({ employee, onOpenDrawer }: Props) => {
  const [progress, setProgress] = useState(0)
  const [timeSince, setTimeSince] = useState('')

  useEffect(() => {
    const updateProgress = () => {
      const start = new Date(employee.last_status_change).getTime()
      const now = Date.now()
      const elapsedMs = now - start
      
      // Calculate progress based on status
      let pct = 0
      if (employee.current_status === 'active') {
        // Standard 8h shift for visualization (8 * 60 * 60 * 1000)
        pct = Math.min(100, (elapsedMs / (8 * 3600000)) * 100)
      } else if (employee.current_status === 'on_break') {
        // Standard 1h break (1 * 60 * 60 * 1000)
        pct = Math.min(100, (elapsedMs / (3600000)) * 100)
      }
      
      setProgress(pct)
      
      // Update time string
      const seconds = Math.floor(elapsedMs / 1000)
      const h = Math.floor(seconds / 3600)
      const m = Math.floor((seconds % 3600) / 60)
      const s = seconds % 60
      setTimeSince(`${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`)
    }

    updateProgress()
    const interval = setInterval(updateProgress, 1000)
    return () => clearInterval(interval)
  }, [employee.last_status_change, employee.current_status])

  const isAlert = employee.current_status === 'on_break' && progress >= 100

  return (
    <div className={`group relative overflow-hidden rounded-[2rem] p-[1.5px] transition-all hover:scale-[1.02] ${
      isAlert ? 'bg-gradient-to-r from-red-500 to-rose-600 animate-pulse' : 'bg-slate-800'
    }`}>
      <div className="relative h-full w-full rounded-[1.95rem] bg-[#0F172A] p-5 shadow-2xl">
        {/* Background Accents */}
        <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-blue-600/10 blur-3xl transition-all group-hover:bg-blue-600/20" />
        
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            {/* Avatar with Status Glow */}
            <div className="relative">
              <div className={`absolute -inset-1 rounded-2xl blur-md opacity-40 transition-opacity group-hover:opacity-60 ${
                employee.current_status === 'active' ? 'bg-emerald-500' :
                employee.current_status === 'on_break' ? 'bg-amber-500' : 'bg-slate-500'
              }`} />
              <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-800 ring-1 ring-white/10 overflow-hidden">
                {employee.photo_url ? (
                  <img src={employee.photo_url} alt="" className="h-full w-full object-cover" />
                ) : (
                  <User size={28} className="text-slate-400" />
                )}
              </div>
              <div className={`absolute -right-1 -top-1 h-3.5 w-3.5 rounded-full border-2 border-[#0F172A] ${
                 employee.current_status === 'active' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(52,211,153,0.8)]' :
                 employee.current_status === 'on_break' ? 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.8)]' : 'bg-slate-500'
              }`} />
            </div>

            <div className="space-y-1">
              <h3 className="text-base font-black tracking-tight text-white group-hover:text-blue-200 transition-colors">
                {employee.first_name} {employee.last_name}
              </h3>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1">
                  <Shield size={10} className="text-blue-500/50" />
                  {employee.job_positions?.name || 'Operativo'}
                </span>
                <span className="text-[10px] font-bold text-slate-600">•</span>
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest overflow-hidden group-hover:text-slate-400 transition-colors">
                  ID: {employee.id.slice(0, 5).toUpperCase()}
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-col items-end gap-2">
            <EmployeeStatusBadge status={employee.current_status} />
            <div className="flex items-center gap-1.5 text-[11px] font-mono font-bold text-blue-400/80">
               <Zap size={12} className="animate-pulse" />
               {timeSince}
            </div>
          </div>
        </div>

        {/* Progress Section */}
        {(employee.current_status === 'active' || employee.current_status === 'on_break') && (
          <div className="mt-6 space-y-2">
            <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest">
              <span className="text-slate-400">
                {employee.current_status === 'active' ? 'Progreso de Jornada' : 'Tiempo de Descanso'}
              </span>
              <span className={isAlert ? 'text-red-400' : 'text-blue-400'}>{Math.round(progress)}%</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-800 ring-1 ring-white/5">
              <div 
                className={`h-full transition-all duration-1000 ease-out rounded-full ${
                  employee.current_status === 'active' ? 'bg-gradient-to-r from-emerald-500 to-teal-400 shadow-[0_0_10px_rgba(52,211,153,0.3)]' :
                  isAlert ? 'bg-gradient-to-r from-red-500 to-rose-600' : 'bg-gradient-to-r from-amber-500 to-orange-400 shadow-[0_0_10px_rgba(245,158,11,0.3)]'
                }`}
                style={{ width: `${progress}%` }}
              />
            </div>
            {isAlert && (
               <p className="text-[9px] font-bold text-red-500 uppercase tracking-tighter flex items-center gap-1 animate-bounce">
                 ⚠️ Limite de tiempo excedido
               </p>
            )}
          </div>
        )}

        {/* Action Button */}
        <div className="mt-6 flex gap-2">
           <button 
            onClick={() => onOpenDrawer(employee)}
            className="flex-1 rounded-2xl bg-white/5 py-2.5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-300 transition-all hover:bg-blue-600 hover:text-white hover:shadow-[0_0_15px_rgba(37,99,235,0.4)] ring-1 ring-white/10"
          >
            Acciones Rápidas
          </button>
        </div>
      </div>
    </div>
  )
}

