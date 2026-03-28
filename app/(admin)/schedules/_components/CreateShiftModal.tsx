'use client'

import React, { useState, useEffect, useActionState, useMemo } from 'react'
import { X, Clock, Utensils, Save, AlertCircle, Calendar, ShieldAlert } from 'lucide-react'
import { createShiftTemplate, updateShiftTemplate, type ActionState } from '../../../actions/schedules'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface CreateShiftModalProps {
  companyId: string
  isOpen: boolean
  onClose: () => void
  initialData?: any
}

const DAYS_OF_WEEK = [
  { id: 1, label: 'Lunes' },
  { id: 2, label: 'Martes' },
  { id: 3, label: 'Miércoles' },
  { id: 4, label: 'Jueves' },
  { id: 5, label: 'Viernes' },
  { id: 6, label: 'Sábado' },
  { id: 0, label: 'Domingo' },
]

export default function CreateShiftModal({
  companyId,
  isOpen,
  onClose,
  initialData,
}: CreateShiftModalProps) {
  const router = useRouter()
  const supabase = createClient()
  
  const currentAction = initialData 
    ? updateShiftTemplate.bind(null, initialData.id)
    : createShiftTemplate

  const [state, action, pending] = useActionState<ActionState, FormData>(currentAction as any, null)

  const [branches, setBranches] = useState<{ id: string; name: string }[]>([])
  
  const [formData, setFormData] = useState({
    name: '',
    branch_id: '',
    lunch_duration: 60,
    late_entry_tolerance: 15,
    early_exit_tolerance: 15,
  })

  // 7-day Matrix State
  const [daysConfig, setDaysConfig] = useState(
    DAYS_OF_WEEK.map(day => ({
      dayOfWeek: day.id,
      label: day.label,
      isActive: day.id !== 0,
      isSeventhDay: day.id === 0,
      startTime: '08:00',
      endTime: '17:00'
    }))
  )

  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        setFormData({
          name: initialData.name || '',
          branch_id: initialData.branch_id || '',
          lunch_duration: initialData.lunch_duration ?? 60,
          late_entry_tolerance: initialData.late_entry_tolerance ?? 15,
          early_exit_tolerance: initialData.early_exit_tolerance ?? 15,
        })
        if (initialData.days_config) {
          setDaysConfig(initialData.days_config)
        }
      } else {
        // Reset to defaults if not editing
        setFormData({
          name: '',
          branch_id: '',
          lunch_duration: 60,
          late_entry_tolerance: 15,
          early_exit_tolerance: 15,
        })
        setDaysConfig(DAYS_OF_WEEK.map(day => ({
          dayOfWeek: day.id,
          label: day.label,
          isActive: day.id !== 0,
          isSeventhDay: day.id === 0,
          startTime: '08:00',
          endTime: '17:00'
        })))
      }
    }
  }, [isOpen, initialData])

  useEffect(() => {
    if (isOpen && companyId) {
      loadBranches()
    }
  }, [isOpen, companyId])

  const loadBranches = async () => {
    const { data } = await supabase
      .from('branches')
      .select('id, name')
      .eq('company_id', companyId)
      .eq('is_active', true)
      .order('name')
    if (data) setBranches(data)
  }

  useEffect(() => {
    if (state && 'success' in state && state.success) {
      onClose()
      router.refresh()
    }
  }, [state, onClose, router])

  // Validations
  const { restingDaysCount, activeDaysCount, goldenRuleMet, effectiveHoursStr } = useMemo(() => {
    const resting = daysConfig.filter(d => d.isSeventhDay).length
    const active = daysConfig.filter(d => d.isActive && !d.isSeventhDay).length
    const meetsRule = resting >= 1 && active <= 6

    // Calc effective hours based on the first active day
    const firstActive = daysConfig.find(d => d.isActive && !d.isSeventhDay)
    let hoursStr = '0.0'
    if (firstActive) {
      const [startH, startM] = firstActive.startTime.split(':').map(Number)
      const [endH, endM] = firstActive.endTime.split(':').map(Number)
      let startMinutes = startH * 60 + startM
      let endMinutes = endH * 60 + endM
      if (endMinutes <= startMinutes) endMinutes += 24 * 60
      const totalMinutes = endMinutes - startMinutes
      const effective = Math.max(0, (totalMinutes - formData.lunch_duration) / 60)
      hoursStr = effective.toFixed(1)
    }

    return { restingDaysCount: resting, activeDaysCount: active, goldenRuleMet: meetsRule, effectiveHoursStr: hoursStr }
  }, [daysConfig, formData.lunch_duration])

  const handleDayChange = (dayId: number, field: string, value: any) => {
    setDaysConfig(prev => prev.map(day => {
      if (day.dayOfWeek === dayId) {
        const newDay = { ...day, [field]: value }
        // Mutually exclusive logic: if marked as seventh day, disable active
        if (field === 'isSeventhDay' && value === true) {
          newDay.isActive = false
        }
        if (field === 'isActive' && value === true) {
          newDay.isSeventhDay = false
        }
        return newDay
      }
      return day
    }))
  }

  const handleApplyAll = () => {
    // Take Monday's settings and apply to all active, non-seventh days
    const monday = daysConfig.find(d => d.dayOfWeek === 1)
    if (!monday) return
    setDaysConfig(prev => prev.map(day => {
      if (day.isActive && !day.isSeventhDay) {
        return { ...day, startTime: monday.startTime, endTime: monday.endTime }
      }
      return day
    }))
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="w-full max-w-5xl max-h-[92vh] flex flex-col bg-white rounded-[40px] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.2)] overflow-hidden animate-in zoom-in-95 duration-300">
        
        {/* Header Section */}
        <div className="px-10 py-8 flex items-center justify-between shrink-0 bg-white">
          <div className="flex items-center gap-5">
            <div className="h-14 w-14 rounded-[20px] bg-slate-900 flex items-center justify-center text-white shadow-xl shadow-slate-200">
              <Calendar size={28} />
            </div>
            <div>
              <h2 className="text-3xl font-black text-slate-900 tracking-tight">
                Arquitecto de Turnos
              </h2>
              <p className="text-[11px] font-black text-slate-400 mt-1 uppercase tracking-[0.2em]">
                Configurador Semanal Inteligente
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="h-12 w-12 flex items-center justify-center rounded-2xl text-slate-300 hover:bg-slate-50 hover:text-slate-900 transition-all duration-200"
          >
            <X size={28} />
          </button>
        </div>

        <form action={action} className="flex-1 overflow-y-auto overflow-x-hidden px-10 pb-10 flex flex-col gap-10">
          <input type="hidden" name="company_id" value={companyId} />
          <input type="hidden" name="days_config" value={JSON.stringify(daysConfig)} />
          {initialData && <input type="hidden" name="id" value={initialData.id} />}

          {state && 'error' in state && (
            <div className="flex gap-3 p-5 rounded-3xl bg-red-50 border-2 border-red-100 text-red-700 text-sm animate-in slide-in-from-top-2">
              <ShieldAlert size={24} className="shrink-0 text-red-500" />
              <p className="font-black">{state.error}</p>
            </div>
          )}

          <div className="grid grid-cols-12 gap-10">
            {/* Left Column: Metadata & Config */}
            <div className="col-span-12 lg:col-span-5 space-y-10">
              
              <div className="space-y-6">
                <div className="space-y-3">
                  <label className="text-[11px] font-black uppercase tracking-widest text-slate-400 ml-1">Patrón Semanal</label>
                  <input
                    type="text"
                    name="name"
                    required
                    placeholder="Ej: Sabatino (L-V libre, Sáb trabajo)"
                    className="w-full h-14 rounded-2xl bg-slate-50 border-2 border-transparent px-6 text-[15px] font-bold text-slate-900 outline-none transition-all placeholder:text-slate-300 focus:bg-white focus:border-slate-900 focus:shadow-xl focus:shadow-slate-100"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>

                <div className="space-y-3">
                  <label className="text-[11px] font-black uppercase tracking-widest text-slate-400 ml-1">Sucursal (Jerarquía)</label>
                  <select
                    name="branch_id"
                    className="w-full h-14 rounded-2xl bg-slate-50 border-2 border-transparent px-6 text-[15px] font-bold text-slate-900 outline-none transition-all focus:bg-white focus:border-slate-900 focus:shadow-xl focus:shadow-slate-100 disabled:opacity-50 appearance-none pointer-events-auto"
                    disabled={!companyId}
                    value={formData.branch_id}
                    onChange={(e) => setFormData({ ...formData, branch_id: e.target.value })}
                  >
                    <option value="">Aplica Globalmente (Todas)</option>
                    {branches.map(b => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                  <p className="text-[10px] font-bold text-slate-400 ml-1 italic">Deshabilitado si no hay empresa en contexto.</p>
                </div>
              </div>

              {/* Pause & Tolerances Card */}
              <div className="p-8 rounded-[32px] bg-white ring-1 ring-slate-100 shadow-[0_20px_40px_-12px_rgba(0,0,0,0.05)] space-y-8">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center text-slate-400">
                    <Utensils size={16} />
                  </div>
                  <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-900">Pausa y Tolerancias</h3>
                </div>
                
                <div className="space-y-6">
                  <div className="flex items-center justify-between group">
                    <span className="text-sm font-bold text-slate-500 group-hover:text-slate-900 transition-colors">Almuerzo (Descanso)</span>
                    <div className="relative w-28">
                      <input
                        type="number"
                        name="lunch_duration"
                        required min="0"
                        className="w-full h-12 rounded-2xl bg-slate-50 border-2 border-transparent pl-4 pr-10 text-[15px] font-black text-slate-900 outline-none transition-all focus:bg-white focus:border-slate-900 text-right"
                        value={formData.lunch_duration}
                        onChange={(e) => setFormData({ ...formData, lunch_duration: parseInt(e.target.value) || 0 })}
                      />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-300">m</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between group">
                    <span className="text-sm font-bold text-slate-500 group-hover:text-slate-900 transition-colors">Tolerancia Entrada</span>
                    <div className="relative w-28">
                      <input
                        type="number"
                        name="late_entry_tolerance"
                        required min="0"
                        className="w-full h-12 rounded-2xl bg-slate-50 border-2 border-transparent pl-4 pr-10 text-[15px] font-black text-slate-900 outline-none transition-all focus:bg-white focus:border-slate-900 text-right"
                        value={formData.late_entry_tolerance}
                        onChange={(e) => setFormData({ ...formData, late_entry_tolerance: parseInt(e.target.value) || 0 })}
                      />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-300">m</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between group">
                    <span className="text-sm font-bold text-slate-500 group-hover:text-slate-900 transition-colors">Tolerancia Salida</span>
                    <div className="relative w-28">
                      <input
                        type="number"
                        name="early_exit_tolerance"
                        required min="0"
                        className="w-full h-12 rounded-2xl bg-slate-50 border-2 border-transparent pl-4 pr-10 text-[15px] font-black text-slate-900 outline-none transition-all focus:bg-white focus:border-slate-900 text-right"
                        value={formData.early_exit_tolerance}
                        onChange={(e) => setFormData({ ...formData, early_exit_tolerance: parseInt(e.target.value) || 0 })}
                      />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-300">m</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: 7-Day Matrix */}
            <div className="col-span-12 lg:col-span-7 p-8 rounded-[40px] bg-slate-50/50 border border-slate-100 flex flex-col gap-6">
              <div className="flex items-center justify-between px-2">
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">Matriz de Jornada</h3>
                <button 
                  type="button" 
                  onClick={handleApplyAll} 
                  className="px-4 py-2 rounded-xl text-[10px] font-black text-sky-600 uppercase tracking-widest hover:bg-sky-50 transition-all"
                >
                  COPIAR LUNES A TODOS
                </button>
              </div>

              <div className="space-y-3 flex-1">
                {daysConfig.map((day) => (
                  <div 
                    key={day.dayOfWeek} 
                    className={`
                      flex items-center justify-between px-6 py-4 rounded-[24px] border-2 transition-all
                      ${day.isSeventhDay ? 'bg-amber-50 border-amber-100 shadow-sm shadow-amber-100/50' : (day.isActive ? 'bg-white border-transparent shadow-sm' : 'bg-slate-100/30 border-transparent opacity-60')}
                    `}
                  >
                    <div className="flex items-center gap-4 w-[160px]">
                      <label className="flex items-center gap-3 cursor-pointer group">
                        <div className="relative flex items-center">
                          <input 
                            type="checkbox" 
                            className="peer sr-only"
                            checked={day.isActive}
                            onChange={(e) => handleDayChange(day.dayOfWeek, 'isActive', e.target.checked)}
                          />
                          <div className={`w-6 h-6 rounded-full border-2 transition-all flex items-center justify-center ${day.isActive ? 'bg-slate-900 border-slate-900' : 'bg-white border-slate-300'}`}>
                            <div className={`w-2 h-2 bg-white rounded-full transition-transform ${day.isActive ? 'scale-100' : 'scale-0'}`} />
                          </div>
                        </div>
                        <span className={`text-[15px] font-black ${day.isActive ? 'text-slate-900' : 'text-slate-400'}`}>{day.label}</span>
                      </label>
                    </div>

                    <div className="flex-1 flex items-center gap-3 justify-center">
                      {day.isSeventhDay ? (
                        <div className="h-10 px-6 flex items-center bg-amber-200 text-amber-900 text-[10px] uppercase tracking-[0.2em] font-black rounded-xl border border-amber-300">
                          DÍA DE DESCANSO
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <div className="relative">
                            <input
                              type="time"
                              disabled={!day.isActive}
                              value={day.startTime}
                              onChange={(e) => handleDayChange(day.dayOfWeek, 'startTime', e.target.value)}
                              className="w-24 h-10 rounded-xl bg-white border-2 border-slate-100 px-2 text-sm font-bold text-center text-slate-900 outline-none transition-all focus:border-slate-900 disabled:opacity-30 disabled:bg-transparent"
                            />
                            <Clock size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none" />
                          </div>
                          <span className="text-slate-200 font-black">—</span>
                          <div className="relative">
                            <input
                              type="time"
                              disabled={!day.isActive}
                              value={day.endTime}
                              onChange={(e) => handleDayChange(day.dayOfWeek, 'endTime', e.target.value)}
                              className="w-24 h-10 rounded-xl bg-white border-2 border-slate-100 px-2 text-sm font-bold text-center text-slate-900 outline-none transition-all focus:border-slate-900 disabled:opacity-30 disabled:bg-transparent"
                            />
                            <Clock size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none" />
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="w-[120px] flex justify-end">
                      <label className="flex items-center gap-3 cursor-pointer group">
                        <span className={`text-[10px] font-black uppercase tracking-wider transition-colors ${day.isSeventhDay ? 'text-amber-600' : 'text-slate-300 group-hover:text-slate-500'}`}>Séptimo Día</span>
                        <input
                          type="checkbox"
                          checked={day.isSeventhDay}
                          onChange={(e) => handleDayChange(day.dayOfWeek, 'isSeventhDay', e.target.checked)}
                          className="w-5 h-5 accent-amber-500 rounded-lg cursor-pointer"
                        />
                      </label>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Validation Banner / Footer */}
          <div className="shrink-0 flex items-center justify-between pt-8 border-t border-slate-100">
            <div className="flex items-center gap-6">
              {!goldenRuleMet ? (
                <div className="flex items-center gap-4 text-red-600 max-w-lg bg-red-50 p-4 rounded-3xl border border-red-100">
                  <ShieldAlert size={24} className="shrink-0" />
                  <p className="text-[13px] font-bold leading-tight">Por ley laboral, es obligatorio asignar al menos 1 día de descanso (Séptimo Día) por cada 6 días trabajados.</p>
                </div>
              ) : (
                <div className="flex items-center gap-8">
                  <div className="rounded-3xl bg-sky-50 px-6 py-3 ring-1 ring-sky-100">
                    <p className="text-[10px] font-black text-sky-600 uppercase tracking-[0.2em] mb-1">Jornada Representativa</p>
                    <p className="text-lg font-black text-sky-900 tracking-tight">{effectiveHoursStr} Horas Efectivas / Día</p>
                  </div>
                  <div className="flex gap-6">
                    <div className="flex flex-col">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Laboral</span>
                      <span className="text-sm font-bold text-slate-900">{activeDaysCount} Día(s)</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[10px] font-black text-amber-500 uppercase tracking-widest">Descanso</span>
                      <span className="text-sm font-bold text-amber-600">{restingDaysCount} Día(s)</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={onClose}
                className="px-8 h-14 rounded-2xl text-[14px] font-black text-slate-400 hover:text-slate-900 hover:bg-slate-50 transition-all"
              >
                DESCARTAR
              </button>
              <button
                type="submit"
                disabled={pending || !goldenRuleMet}
                className="px-10 h-14 rounded-2xl bg-slate-900 text-white text-[14px] font-black shadow-2xl shadow-slate-200 hover:bg-slate-800 active:scale-[0.98] transition-all flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-widest"
              >
                {pending ? (
                  <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <Save size={20} />
                    Guardar Cambios
                  </>
                )}
              </button>
            </div>
          </div>

        </form>
      </div>
    </div>
  )
}
