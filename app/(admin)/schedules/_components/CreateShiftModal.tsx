'use client'

import React, { useState, useEffect, useActionState } from 'react'
import { X, Clock, Utensils, Save, AlertCircle } from 'lucide-react'
import { createShiftTemplate, type ActionState } from '../../../actions/schedules'
import { useRouter } from 'next/navigation'

interface CreateShiftModalProps {
  companyId: string
  isOpen: boolean
  onClose: () => void
}

export default function CreateShiftModal({
  companyId,
  isOpen,
  onClose,
}: CreateShiftModalProps) {
  const router = useRouter()
  const [state, action, pending] = useActionState<ActionState, FormData>(createShiftTemplate as any, null)

  const [formData, setFormData] = useState({
    name: '',
    start_time: '08:00',
    end_time: '17:00',
    lunch_duration: 60,
  })

  const [effectiveHours, setEffectiveHours] = useState<number>(0)

  useEffect(() => {
    calculateEffectiveHours()
  }, [formData])

  useEffect(() => {
    if (state && 'success' in state && state.success) {
      onClose()
      router.refresh()
    }
  }, [state, onClose, router])

  const calculateEffectiveHours = () => {
    const [startH, startM] = formData.start_time.split(':').map(Number)
    const [endH, endM] = formData.end_time.split(':').map(Number)
    
    let startMinutes = startH * 60 + startM
    let endMinutes = endH * 60 + endM
    
    if (endMinutes <= startMinutes) {
      endMinutes += 24 * 60 // Night shift
    }
    
    const totalMinutes = endMinutes - startMinutes
    const effective = (totalMinutes - formData.lunch_duration) / 60
    setEffectiveHours(Math.max(0, effective))
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300">
      <div className="w-full max-w-xl bg-white rounded-[40px] shadow-[0_32px_64px_-12px_rgba(0,0,0,0.14)] overflow-hidden ring-1 ring-slate-100 animate-in zoom-in-95 duration-300">
        
        {/* Header Section */}
        <div className="px-10 py-8 border-b border-slate-50 flex items-center justify-between bg-white">
          <div>
            <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">Nueva Plantilla de Turno</h2>
            <p className="text-sm font-medium text-slate-400 mt-1">Configura horarios globales para tu organización</p>
          </div>
          <button 
            onClick={onClose}
            className="p-3 rounded-2xl text-slate-400 hover:bg-slate-50 hover:text-slate-900 transition-all duration-200"
          >
            <X size={26} />
          </button>
        </div>

        <form action={action} className="p-10 space-y-8">
          <input type="hidden" name="company_id" value={companyId} />

          {state && 'error' in state && (
            <div className="flex gap-4 p-5 rounded-[24px] bg-red-50/50 border border-red-100 text-red-600 text-sm animate-in slide-in-from-top-2">
              <AlertCircle size={22} className="shrink-0" />
              <p className="font-semibold leading-relaxed">{state.error}</p>
            </div>
          )}

          {/* Nombre Field Group */}
          <div className="space-y-3">
            <label className="text-sm font-bold text-slate-900 px-1">Título del Horario</label>
            <div className="relative group">
              <input
                type="text"
                name="name"
                required
                placeholder="Ej: Turno Matutino - Nicaragua"
                className="w-full h-14 rounded-2xl border-2 border-transparent bg-slate-50 px-5 text-sm font-bold text-slate-900 outline-none transition-all duration-200 placeholder:text-slate-300 group-hover:bg-slate-100 focus:bg-white focus:border-slate-900 focus:shadow-sm"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
          </div>

          {/* Time Picker Group */}
          <div className="grid grid-cols-2 gap-8">
            <div className="space-y-3">
              <label className="flex items-center gap-2 text-sm font-bold text-slate-900 px-1">
                <Clock size={16} className="text-slate-400" />
                Entrada
              </label>
              <input
                type="time"
                name="start_time"
                required
                className="w-full h-14 rounded-2xl border-2 border-transparent bg-slate-50 px-5 text-sm font-bold text-slate-900 outline-none transition-all duration-200 group-hover:bg-slate-100 focus:bg-white focus:border-slate-900"
                value={formData.start_time}
                onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
              />
            </div>

            <div className="space-y-3">
              <label className="flex items-center gap-2 text-sm font-bold text-slate-900 px-1">
                <Clock size={16} className="text-slate-400" />
                Salida
              </label>
              <input
                type="time"
                name="end_time"
                required
                className="w-full h-14 rounded-2xl border-2 border-transparent bg-slate-50 px-5 text-sm font-bold text-slate-900 outline-none transition-all duration-200 group-hover:bg-slate-100 focus:bg-white focus:border-slate-900"
                value={formData.end_time}
                onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
              />
            </div>
          </div>

          {/* Lunch Duration */}
          <div className="space-y-3">
            <label className="flex items-center gap-2 text-sm font-bold text-slate-900 px-1">
              <Utensils size={16} className="text-slate-400" />
              Minutos de Almuerzo / Pausa
            </label>
            <div className="relative">
              <input
                type="number"
                name="lunch_duration"
                required
                min="0"
                placeholder="Ej: 60"
                className="w-full h-14 rounded-2xl border-2 border-transparent bg-slate-50 px-5 text-sm font-bold text-slate-900 outline-none transition-all duration-200 group-hover:bg-slate-100 focus:bg-white focus:border-slate-900"
                value={formData.lunch_duration}
                onChange={(e) => setFormData({ ...formData, lunch_duration: parseInt(e.target.value) || 0 })}
              />
              <span className="absolute right-5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 uppercase tracking-widest">Minutos</span>
            </div>
          </div>

          {/* PREMIUM RESULT WIDGET ("El Corazón") */}
          <div className="relative overflow-hidden rounded-[32px] bg-sky-50 p-6 flex items-center justify-between ring-1 ring-sky-100 select-none group">
            <div className="absolute right-0 top-0 -mr-4 -mt-4 opacity-5 group-hover:opacity-10 transition-opacity">
              <Clock size={120} />
            </div>
            
            <div className="relative space-y-1">
              <p className="text-[11px] font-black uppercase tracking-[0.15em] text-sky-600">Jornada Calculada</p>
              <h3 className="text-3xl font-black text-sky-900 tracking-tight">
                {effectiveHours.toFixed(1)} <span className="text-xl font-bold opacity-80">Horas Efectivas</span>
              </h3>
              <p className="text-xs font-medium text-sky-700/70 antialiased">
                Cálculo neto tras descontar {formData.lunch_duration} min de pausa laboral.
              </p>
            </div>

            <div className="hidden sm:flex h-14 w-14 items-center justify-center rounded-2xl bg-white/60 text-sky-600 backdrop-blur-md shadow-sm">
                <Save size={24} strokeWidth={2.5} />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center gap-4 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="w-full sm:w-1/3 h-14 rounded-2xl text-sm font-bold text-slate-500 hover:bg-slate-50 hover:text-slate-900 transition-all duration-200"
            >
              Cerrar
            </button>
            <button
              type="submit"
              disabled={pending}
              className="w-full sm:w-2/3 h-14 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-800 text-white text-sm font-bold shadow-xl shadow-slate-200 hover:shadow-2xl hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] transition-all duration-300 flex items-center justify-center gap-3 disabled:opacity-50 disabled:translate-y-0 disabled:shadow-none"
            >
              {pending ? (
                <div className="h-6 w-6 border-3 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <Save size={20} />
                  Guardar Plantilla
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
