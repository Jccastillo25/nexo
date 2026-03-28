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
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300">
      <div className="w-full max-w-4xl max-h-[90vh] flex flex-col bg-white rounded-[32px] shadow-[0_24px_48px_-12px_rgba(0,0,0,0.25)] overflow-hidden ring-1 ring-slate-100 animate-in zoom-in-95 duration-300">
        
        {/* Header Section */}
        <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between shrink-0 bg-white">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-2xl bg-slate-900 flex items-center justify-center text-white shadow-lg shadow-slate-200">
              <Calendar size={24} />
            </div>
            <div>
              <h2 className="text-2xl font-black text-slate-900 tracking-tight">
                {initialData ? 'Editar Patrón' : 'Arquitecto de Turnos'}
              </h2>
              <p className="text-xs font-bold text-slate-400 mt-1 uppercase tracking-widest">
                {initialData ? 'Modificando configuración semanal' : 'Configurador Semanal Inteligente'}
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-900 transition-all duration-200"
          >
            <X size={24} />
          </button>
        </div>

        <form action={action} className="flex-1 overflow-y-auto overflow-x-hidden p-8 flex flex-col gap-8 bg-slate-50/50">
          <input type="hidden" name="company_id" value={companyId} />
          <input type="hidden" name="days_config" value={JSON.stringify(daysConfig)} />
          {initialData && <input type="hidden" name="id" value={initialData.id} />}

          {state && 'error' in state && (
            <div className="flex gap-3 p-4 rounded-2xl bg-red-50/80 border border-red-200 text-red-700 text-sm animate-in slide-in-from-top-1 shadow-sm">
              <ShieldAlert size={20} className="shrink-0 text-red-500" />
              <p className="font-bold">{state.error}</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-8">
            {/* Left Column: Metadata */}
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-wider text-slate-500 ml-1">Patrón Semanal</label>
                <input
                  type="text"
                  name="name"
                  required
                  placeholder="Ej: Sabatino (L-V libre, Sáb trabajo)"
                  className="w-full h-12 rounded-2xl bg-white border-2 border-slate-200 px-4 text-sm font-bold text-slate-900 outline-none transition-all placeholder:text-slate-300 focus:border-slate-900 shadow-sm"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-wider text-slate-500 ml-1">Sucursal (Jerarquía)</label>
                <select
                  name="branch_id"
                  className="w-full h-12 rounded-2xl bg-white border-2 border-slate-200 px-4 text-sm font-bold text-slate-900 outline-none transition-all focus:border-slate-900 disabled:opacity-50 shadow-sm"
                  disabled={!companyId}
                  value={formData.branch_id}
                  onChange={(e) => setFormData({ ...formData, branch_id: e.target.value })}
                >
                  <option value="">Aplica Globalmente (Todas)</option>
                  {branches.map(b => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
                <p className="text-[10px] font-bold text-slate-400 ml-1">Deshabilitado si no hay empresa en contexto.</p>
              </div>

              <div className="space-y-4 p-5 rounded-3xl bg-white border border-slate-200 shadow-sm">
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 flex items-center gap-2">
                  <Utensils size={14} className="text-slate-400" /> Pausa y Tolerancias
                </h3>
                
                <div className="grid grid-cols-1 gap-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-slate-600">Almuerzo (Descanso)</span>
                    <div className="relative w-24">
                      <input
                        type="number"
                        name="lunch_duration"
                        required min="0"
                        className="w-full h-10 rounded-xl bg-slate-50 border border-slate-200 pl-3 pr-8 text-sm font-bold text-slate-900 outline-none focus:border-slate-900 text-right"
                        value={formData.lunch_duration}
                        onChange={(e) => setFormData({ ...formData, lunch_duration: parseInt(e.target.value) || 0 })}
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400">m</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-slate-600">Tolerancia Entrada</span>
                    <div className="relative w-24">
                      <input
                        type="number"
                        name="late_entry_tolerance"
                        required min="0"
                        className="w-full h-10 rounded-xl bg-slate-50 border border-slate-200 pl-3 pr-8 text-sm font-bold text-slate-900 outline-none focus:border-slate-900 text-right"
                        value={formData.late_entry_tolerance}
                        onChange={(e) => setFormData({ ...formData, late_entry_tolerance: parseInt(e.target.value) || 0 })}
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400">m</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-slate-600">Tolerancia Salida</span>
                    <div className="relative w-24">
                      <input
                        type="number"
                        name="early_exit_tolerance"
                        required min="0"
                        className="w-full h-10 rounded-xl bg-slate-50 border border-slate-200 pl-3 pr-8 text-sm font-bold text-slate-900 outline-none focus:border-slate-900 text-right"
                        value={formData.early_exit_tolerance}
                        onChange={(e) => setFormData({ ...formData, early_exit_tolerance: parseInt(e.target.value) || 0 })}
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400">m</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: 7-Day Matrix */}
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-4 flex flex-col">
              <div className="flex items-center justify-between px-2 mb-4">
                <h3 className="text-sm font-black text-slate-900">Matriz de Jornada</h3>
                <button type="button" onClick={handleApplyAll} className="text-[10px] font-bold text-sky-600 uppercase hover:underline">
                  Copiar Lunes a Todos
                </button>
              </div>

              <div className="space-y-2 flex-1 relative">
                {daysConfig.map((day) => (
                  <div key={day.dayOfWeek} className={`flex items-center justify-between p-3 rounded-2xl transition-colors border ${day.isSeventhDay ? 'bg-amber-50/50 border-amber-100' : (day.isActive ? 'bg-slate-50/50 border-slate-100' : 'bg-slate-50/30 border-transparent opacity-60')}`}>
                    <div className="flex items-center gap-3 w-1/3">
                      <label className="flex items-center gap-2 cursor-pointer group">
                        <div className="relative flex items-center">
                          <input 
                            type="checkbox" 
                            className="peer sr-only"
                            checked={day.isActive}
                            onChange={(e) => handleDayChange(day.dayOfWeek, 'isActive', e.target.checked)}
                          />
                          <div className={`w-5 h-5 rounded-md border-2 transition-all flex items-center justify-center ${day.isActive ? 'bg-slate-900 border-slate-900' : 'bg-white border-slate-300'}`}>
                            <div className={`w-2 h-2 bg-white rounded-sm transition-transform ${day.isActive ? 'scale-100' : 'scale-0'}`} />
                          </div>
                        </div>
                        <span className={`text-xs font-bold ${day.isActive ? 'text-slate-900' : 'text-slate-400'}`}>{day.label}</span>
                      </label>
                    </div>

                    <div className="flex items-center gap-2 w-1/3 justify-center">
                      {day.isSeventhDay ? (
                        <div className="px-3 py-1 bg-amber-100 text-amber-800 text-[10px] uppercase tracking-widest font-black rounded-lg">
                          Día de Descanso
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <input
                            type="time"
                            disabled={!day.isActive}
                            value={day.startTime}
                            onChange={(e) => handleDayChange(day.dayOfWeek, 'startTime', e.target.value)}
                            className="w-20 h-8 rounded-lg bg-white border border-slate-200 text-xs font-bold text-center outline-none disabled:opacity-50"
                          />
                          <span className="text-slate-300">-</span>
                          <input
                            type="time"
                            disabled={!day.isActive}
                            value={day.endTime}
                            onChange={(e) => handleDayChange(day.dayOfWeek, 'endTime', e.target.value)}
                            className="w-20 h-8 rounded-lg bg-white border border-slate-200 text-xs font-bold text-center outline-none disabled:opacity-50"
                          />
                        </div>
                      )}
                    </div>

                    <div className="w-1/4 flex justify-end">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <span className={`text-[10px] font-black uppercase tracking-wider ${day.isSeventhDay ? 'text-amber-600' : 'text-slate-400'}`}>Séptimo Día</span>
                        <input
                          type="checkbox"
                          checked={day.isSeventhDay}
                          onChange={(e) => handleDayChange(day.dayOfWeek, 'isSeventhDay', e.target.checked)}
                          className="accent-amber-500 w-4 h-4"
                        />
                      </label>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="h-px w-full bg-slate-200 shrink-0 my-2" />

          {/* Validation Banner / Footer */}
          <div className="shrink-0 flex items-center justify-between">
            <div className="flex items-center gap-4">
              {!goldenRuleMet ? (
                <div className="flex items-center gap-2 text-red-600 max-w-md">
                  <ShieldAlert size={20} className="shrink-0" />
                  <p className="text-xs font-bold leading-tight">Por ley laboral, es obligatorio asignar al menos 1 día de descanso (Séptimo Día) por cada 6 días trabajados.</p>
                </div>
              ) : (
                <div className="flex items-center gap-4">
                  <div className="rounded-xl bg-sky-50 px-4 py-2 ring-1 ring-sky-100">
                    <p className="text-[10px] font-black text-sky-600 uppercase tracking-widest mb-0.5">Jornada Representativa</p>
                    <p className="text-sm font-bold text-sky-900">{effectiveHoursStr} Horas Efectivas / Día</p>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-slate-700">{activeDaysCount} Día(s) Laborales</span>
                    <span className="text-xs font-bold text-amber-600">{restingDaysCount} Día(s) de Descanso</span>
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-6 h-12 rounded-2xl text-sm font-bold text-slate-500 hover:bg-slate-200 transition-all font-black"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={pending || !goldenRuleMet}
                className="px-8 h-12 rounded-2xl bg-slate-900 text-white text-sm font-bold shadow-xl shadow-slate-200 hover:bg-slate-800 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed font-black"
              >
                {pending ? (
                  <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <Save size={18} />
                    Guardar Matriz
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
