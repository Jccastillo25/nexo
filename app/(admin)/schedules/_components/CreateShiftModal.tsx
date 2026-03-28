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
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="w-full max-w-md bg-white rounded-[32px] shadow-[0_24px_48px_-12px_rgba(0,0,0,0.12)] overflow-hidden ring-1 ring-slate-100 animate-in zoom-in-95 duration-300">
        
        {/* Header Section - More Compact */}
        <div className="px-6 py-5 border-b border-slate-50 flex items-center justify-between bg-white">
          <div>
            <h2 className="text-lg font-bold text-slate-900 tracking-tight">Nuevo Turno</h2>
            <p className="text-[11px] font-medium text-slate-400 mt-0.5 uppercase tracking-wider">Librería Global</p>
          </div>
          <button 
            onClick={onClose}
            className="p-2 rounded-xl text-slate-300 hover:bg-slate-50 hover:text-slate-900 transition-all duration-200"
          >
            <X size={20} />
          </button>
        </div>

        <form action={action} className="p-6 space-y-5">
          <input type="hidden" name="company_id" value={companyId} />

          {state && 'error' in state && (
            <div className="flex gap-3 p-4 rounded-2xl bg-red-50/50 border border-red-100 text-red-600 text-xs animate-in slide-in-from-top-1">
              <AlertCircle size={18} className="shrink-0" />
              <p className="font-semibold">{state.error}</p>
            </div>
          )}

          {/* Nombre Field */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-500 px-1">Título del Horario</label>
            <input
              type="text"
              name="name"
              required
              placeholder="Ej: Matutino - Nicaragua"
              className="w-full h-11 rounded-xl bg-slate-50 border-2 border-transparent px-4 text-sm font-bold text-slate-900 outline-none transition-all placeholder:text-slate-300 focus:bg-white focus:border-slate-900"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            />
          </div>

          {/* Times and Lunch in a denser grid */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="flex items-center gap-1.5 text-xs font-bold text-slate-500 px-1">
                <Clock size={14} />
                Entrada
              </label>
              <input
                type="time"
                name="start_time"
                required
                className="w-full h-11 rounded-xl bg-slate-50 border-2 border-transparent px-4 text-sm font-bold text-slate-900 outline-none transition-all focus:bg-white focus:border-slate-900"
                value={formData.start_time}
                onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <label className="flex items-center gap-1.5 text-xs font-bold text-slate-500 px-1">
                <Clock size={14} />
                Salida
              </label>
              <input
                type="time"
                name="end_time"
                required
                className="w-full h-11 rounded-xl bg-slate-50 border-2 border-transparent px-4 text-sm font-bold text-slate-900 outline-none transition-all focus:bg-white focus:border-slate-900"
                value={formData.end_time}
                onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="flex items-center gap-1.5 text-xs font-bold text-slate-500 px-1">
              <Utensils size={14} />
              Minutos de Pausa Almuerzo
            </label>
            <div className="relative">
              <input
                type="number"
                name="lunch_duration"
                required
                min="0"
                placeholder="Ej: 60"
                className="w-full h-11 rounded-xl bg-slate-50 border-2 border-transparent px-4 text-sm font-bold text-slate-900 outline-none transition-all focus:bg-white focus:border-slate-900"
                value={formData.lunch_duration}
                onChange={(e) => setFormData({ ...formData, lunch_duration: parseInt(e.target.value) || 0 })}
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400 uppercase">Min</span>
            </div>
          </div>

          {/* Compact Info Badge */}
          <div className="flex items-center justify-between px-2">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-sky-500" />
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Jornada Final</p>
            </div>
            <div className="rounded-lg bg-sky-50 px-2.5 py-1 text-xs font-bold text-sky-700 ring-1 ring-sky-100">
              {effectiveHours.toFixed(1)} Horas Efectivas
            </div>
          </div>

          {/* Action Row - One Line */}
          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-6 h-11 rounded-xl text-sm font-bold text-slate-400 hover:bg-slate-50 hover:text-slate-900 transition-all"
            >
              Cerrar
            </button>
            <button
              type="submit"
              disabled={pending}
              className="flex-1 h-11 rounded-xl bg-slate-900 text-white text-sm font-bold shadow-lg shadow-slate-100 hover:bg-slate-800 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {pending ? (
                <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <Save size={18} />
                  Guardar Turno
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
