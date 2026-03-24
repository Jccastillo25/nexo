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
        p_employee_id: employee.id,
        p_action: action,
        p_notes: notes,
        p_source: 'MONITOR',
        p_metadata: { source: 'MONITOR_DRAWER', recorded_by_monitor: true }
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
      <div className={`fixed right-0 top-0 z-50 h-full w-full max-w-md transform bg-white shadow-2xl ring-1 ring-slate-200 transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="flex h-full flex-col">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-100 p-6">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                Panel de Acción
              </p>
              <h2 className="mt-1 text-xl font-bold text-slate-900">
                {employee.first_name} {employee.last_name}
              </h2>
            </div>
            <button 
              onClick={onClose}
              className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            >
              <X size={24} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-8">
            {/* Status & Clock */}
            <div className="flex items-center justify-between rounded-3xl bg-slate-50 p-6">
              <div className="space-y-1">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Estado Actual</p>
                <div className="flex items-center gap-2">
                  <EmployeeStatusBadge status={employee.current_status} className="scale-110 origin-left" />
                </div>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Hora Servidor</p>
                <DigitalClock className="text-xl font-bold text-slate-900" />
              </div>
            </div>

            {/* Buttons Grid */}
            <div className="grid grid-cols-2 gap-4">
              <ActionButton 
                label="Entrada" 
                color="bg-green-600 hover:bg-green-700" 
                onClick={() => handleAction('CLOCK_IN')}
                disabled={employee.current_status === 'active' || isSubmitting}
              />
              <ActionButton 
                label="Descanso" 
                color="bg-amber-500 hover:bg-amber-600" 
                onClick={() => handleAction('START_BREAK')}
                disabled={employee.current_status !== 'active' || isSubmitting}
              />
              <ActionButton 
                label="Reanudar" 
                color="bg-blue-600 hover:bg-blue-700" 
                onClick={() => handleAction('END_BREAK')}
                disabled={employee.current_status !== 'on_break' || isSubmitting}
              />
              <ActionButton 
                label="Salida" 
                color="bg-slate-900 hover:bg-black" 
                onClick={() => handleAction('CLOCK_OUT')}
                disabled={employee.current_status === 'offline' || isSubmitting}
              />
            </div>

            {/* Incident Form */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                <AlertCircle size={18} className="text-slate-400" />
                <h3 className="text-sm font-bold text-slate-900">Registrar Incidencia / Notas</h3>
              </div>
              
              <div className="space-y-3">
                <select 
                  value={incidenteType}
                  onChange={(e) => setIncidenteType(e.target.value)}
                  className="w-full rounded-2xl border-slate-200 bg-white text-sm shadow-sm ring-1 ring-slate-200 focus:border-blue-500 focus:ring-blue-500"
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
                  className="h-32 w-full rounded-2xl border-slate-200 bg-white text-sm shadow-sm ring-1 ring-slate-200 focus:border-blue-500 focus:ring-blue-500"
                />

                <div className="flex gap-2">
                   <button className="flex flex-1 items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-200 p-4 text-xs font-semibold text-slate-400 transition hover:border-slate-300 hover:text-slate-600">
                    <Camera size={18} />
                    Cargar Foto
                   </button>
                   <button className="flex flex-1 items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-200 p-4 text-xs font-semibold text-slate-400 transition hover:border-slate-300 hover:text-slate-600">
                    <FileText size={18} />
                    Archivo PDF
                   </button>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="border-t border-slate-100 p-6 bg-slate-50 flex gap-4">
            <button 
              onClick={onClose}
              className="flex-1 rounded-2xl bg-white px-4 py-3 text-sm font-bold text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
            >
              Cancelar
            </button>
            <button 
              disabled={isSubmitting || !notes}
              onClick={() => handleAction('NOTE_ONLY')} // Custom action if just saving notes
              className="flex-1 rounded-2xl bg-blue-600 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-blue-500/30 hover:bg-blue-700 disabled:opacity-50"
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
