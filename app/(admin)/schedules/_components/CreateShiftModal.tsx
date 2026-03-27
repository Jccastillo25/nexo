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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-white rounded-[32px] shadow-2xl shadow-slate-900/20 overflow-hidden ring-1 ring-slate-200 animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-white">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Nueva Plantilla de Turno</h2>
            <p className="text-sm text-slate-500 mt-1 text-balance">Define un horario base para la Planilla Maestra.</p>
          </div>
          <button 
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:bg-slate-50 hover:text-slate-900 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        <form action={action} className="p-8 space-y-6">
          <input type="hidden" name="company_id" value={companyId} />

          {state && 'error' in state && (
            <div className="flex gap-3 p-4 rounded-2xl bg-red-50 border border-red-100 text-red-600 text-sm">
              <AlertCircle size={20} className="shrink-0" />
              <p className="font-medium">{state.error}</p>
            </div>
          )}

          {/* Nombre */}
          <div>
            <label className="block text-sm font-bold text-slate-900 mb-2">Nombre del Turno *</label>
            <input
              type="text"
              name="name"
              required
              placeholder="Ej. Matutino Local"
              className="w-full h-12 rounded-2xl border-2 border-slate-200 bg-white px-4 text-sm font-bold text-slate-900 outline-none transition-all focus:border-slate-900"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-6">
            {/* Entrada */}
            <div>
              <label className="flex items-center gap-2 text-sm font-bold text-slate-900 mb-2">
                <Clock size={16} className="text-slate-400" />
                Hora de Entrada
              </label>
              <input
                type="time"
                name="start_time"
                required
                className="w-full h-12 rounded-2xl border-2 border-slate-200 bg-white px-4 text-sm font-bold text-slate-900 outline-none transition-all focus:border-slate-900"
                value={formData.start_time}
                onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
              />
            </div>

            {/* Salida */}
            <div>
              <label className="flex items-center gap-2 text-sm font-bold text-slate-900 mb-2">
                <Clock size={16} className="text-slate-400" />
                Hora de Salida
              </label>
              <input
                type="time"
                name="end_time"
                required
                className="w-full h-12 rounded-2xl border-2 border-slate-200 bg-white px-4 text-sm font-bold text-slate-900 outline-none transition-all focus:border-slate-900"
                value={formData.end_time}
                onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
              />
            </div>
          </div>

          {/* Pausa */}
          <div>
            <label className="flex items-center gap-2 text-sm font-bold text-slate-900 mb-2">
              <Utensils size={16} className="text-slate-400" />
              Minutos de Almuerzo / Pausa *
            </label>
            <input
              type="number"
              name="lunch_duration"
              required
              min="0"
              placeholder="Ej: 60"
              className="w-full h-12 rounded-2xl border-2 border-slate-200 bg-white px-4 text-sm font-bold text-slate-900 outline-none transition-all focus:border-slate-900"
              value={formData.lunch_duration}
              onChange={(e) => setFormData({ ...formData, lunch_duration: parseInt(e.target.value) || 0 })}
            />
          </div>

          {/* Preview Panel */}
          <div className="p-5 rounded-3xl bg-slate-50 ring-1 ring-slate-200 space-y-2">
            <div className="flex justify-between items-center text-xs font-semibold uppercase tracking-wider text-slate-400">
              <span>Cálculo de Jornada</span>
              <span className="text-slate-900 font-bold tracking-normal">Jornada efectiva: {effectiveHours.toFixed(1)} horas</span>
            </div>
            <div className="h-2 w-full bg-slate-200 rounded-full overflow-hidden">
              <div 
                className="h-full bg-slate-900 transition-all duration-500"
                style={{ width: `${Math.min(100, (effectiveHours / 12) * 100)}%` }}
              />
            </div>
            <p className="text-[10px] text-slate-500 italic">
              * (Salida - Entrada) - Pausa = {effectiveHours.toFixed(1)} horas efectivas de labor.
            </p>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 h-12 rounded-2xl border-2 border-slate-200 text-sm font-bold text-slate-600 hover:bg-slate-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={pending}
              className="flex-[2] h-12 rounded-2xl bg-slate-900 text-white text-sm font-bold hover:bg-slate-800 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {pending ? (
                <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <Save size={18} />
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
