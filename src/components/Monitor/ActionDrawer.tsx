'use client'

import React, { useState } from 'react'
import { X, Clock, AlertCircle, FileText, Camera } from 'lucide-react'
import { DigitalClock } from './DigitalClock'
import { EmployeeStatusBadge } from './EmployeeStatusBadge'
import { useAttachmentUpload } from '@/hooks/useAttachmentUpload'
import { createClient } from '@/lib/supabase/client'

interface Props {
  employee: any | null
  isOpen: boolean
  onClose: () => void
}

export const ActionDrawer = ({ employee, isOpen, onClose }: Props) => {
  const [notes, setNotes] = useState('')
  const [incidenteType, setIncidenteType] = useState('permiso')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const { uploadFile, isUploading } = useAttachmentUpload()
  const supabase = createClient()

  if (!employee) return null

  const handleAction = async (action: string) => {
    setIsSubmitting(true)
    try {
      // 1. Call RPC for marking attendance
      const { data, error } = await supabase.rpc('rpc_mark_attendance_action', {
        p_company_id: employee.company_id,
        p_employee_id: employee.id,
        p_action: action,
        p_source: 'MONITOR',
        p_notes: notes || `Marcación manual desde Monitor por supervisor`
      })

      if (error) throw error

      setNotes('')
      onClose()
    } catch (err: any) {
      alert(`Error al marcar: ${err.message}`)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <>
      {/* Overlay */}
      <div 
        className={`fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-sm transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
        onClick={onClose}
      />

      {/* Drawer */}
      <div className={`fixed right-0 top-0 z-50 h-full w-full max-w-md transform bg-slate-900 border-l border-slate-700/50 shadow-2xl transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="flex h-full flex-col">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-700/50 p-6">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                Panel de Acción
              </p>
              <h2 className="mt-1 text-xl font-black tracking-tight text-white">
                {employee.first_name} {employee.last_name}
              </h2>
            </div>
            <button 
              onClick={onClose}
              className="rounded-full p-2 text-slate-500 hover:bg-slate-800 hover:text-white transition-colors"
            >
              <X size={24} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-8">
            {/* Status & Clock */}
            <div className="flex items-center justify-between app-surface p-5">
              <div className="space-y-1">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Estado Actual</p>
                <div className="flex items-center gap-2">
                  <EmployeeStatusBadge status={employee.current_status} className="scale-110 origin-left" />
                </div>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Hora Servidor</p>
                <DigitalClock className="text-xl font-black tracking-tight text-white" />
              </div>
            </div>

            {/* Buttons Grid */}
            <div className="grid grid-cols-2 gap-3">
              <ActionButton 
                label="Entrada" 
                color="bg-emerald-500 hover:bg-emerald-600 shadow-lg shadow-emerald-500/20" 
                onClick={() => handleAction('CLOCK_IN')}
                disabled={employee.current_status === 'active' || isSubmitting}
              />
              <ActionButton 
                label="Descanso" 
                color="bg-amber-500 hover:bg-amber-600 shadow-lg shadow-amber-500/20" 
                onClick={() => handleAction('START_BREAK')}
                disabled={employee.current_status !== 'active' || isSubmitting}
              />
              <ActionButton 
                label="Reanudar" 
                color="bg-blue-500 hover:bg-blue-600 shadow-lg shadow-blue-500/20" 
                onClick={() => handleAction('END_BREAK')}
                disabled={employee.current_status !== 'on_break' || isSubmitting}
              />
              <ActionButton 
                label="Salida" 
                color="bg-slate-700 hover:bg-slate-600 border border-slate-600" 
                onClick={() => handleAction('CLOCK_OUT')}
                disabled={employee.current_status === 'offline' || isSubmitting}
              />
            </div>

            {/* Incident Form */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 border-b border-slate-700/50 pb-3">
                <AlertCircle size={16} className="text-blue-500" />
                <h3 className="text-[11px] font-black uppercase tracking-widest text-white">Registrar Incidencia / Notas</h3>
              </div>
              
              <div className="space-y-3">
                <select 
                  value={incidenteType}
                  onChange={(e) => setIncidenteType(e.target.value)}
                  className="h-12 w-full rounded-xl border border-slate-700 bg-slate-800 px-4 text-sm text-white outline-none focus:border-blue-500"
                >
                  <option value="permiso">Permiso Especial</option>
                  <option value="ausencia">Ausencia Justificada</option>
                  <option value="justificante">Carga de Justificante</option>
                  <option value="nota">Nota de Supervisión</option>
                </select>

                <textarea 
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Escribe el motivo o nota aquí..."
                  className="h-32 w-full rounded-xl border border-slate-700 bg-slate-800 p-4 text-sm text-white placeholder:text-slate-500 outline-none focus:border-blue-500 resize-none"
                />

                <div className="flex gap-2">
                   <button className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-dashed border-slate-700 p-4 text-[11px] font-black uppercase tracking-widest text-slate-500 transition hover:border-blue-500/50 hover:text-blue-400">
                    <Camera size={16} />
                    Foto
                   </button>
                   <button className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-dashed border-slate-700 p-4 text-[11px] font-black uppercase tracking-widest text-slate-500 transition hover:border-blue-500/50 hover:text-blue-400">
                    <FileText size={16} />
                    PDF
                   </button>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="border-t border-slate-700/50 p-6 bg-slate-900/80 flex gap-3">
            <button 
              onClick={onClose}
              className="flex-1 rounded-xl bg-slate-800 border border-slate-700 px-4 py-3 text-[11px] font-black uppercase tracking-widest text-slate-400 hover:bg-slate-700 hover:text-white transition-colors"
            >
              Cancelar
            </button>
            <button 
              disabled={isSubmitting || !notes}
              onClick={() => handleAction('NOTE_ONLY')}
              className="flex-1 rounded-xl bg-blue-500 px-4 py-3 text-[11px] font-black uppercase tracking-widest text-white shadow-lg shadow-blue-500/20 hover:bg-blue-600 disabled:opacity-40 transition-all"
            >
              Guardar Nota
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

const ActionButton = ({ label, color, onClick, disabled }: any) => (
  <button
    disabled={disabled}
    onClick={onClick}
    className={`flex h-24 flex-col items-center justify-center rounded-3xl text-sm font-bold text-white transition-all active:scale-95 disabled:opacity-30 disabled:grayscale ${color} shadow-lg`}
  >
    {label}
  </button>
)
