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
        className={`fixed inset-0 z-40 backdrop-blur-sm transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
        style={{ background: 'rgba(15,23,42,0.6)' }}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer */}
      <div
        className={`action-drawer fixed right-0 top-0 z-50 h-full w-full max-w-md transform transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}
        role="dialog"
        aria-modal="true"
        aria-label={`Panel de acción — ${employee.first_name} ${employee.last_name}`}
      >
        <div className="flex h-full flex-col">
          {/* Header */}
          <div className="flex items-center justify-between border-b p-6" style={{ borderColor: 'var(--border-soft)' }}>
            <div>
              <p className="section-label">Panel de Acción</p>
              <h2 className="mt-1 text-xl font-black tracking-tight" style={{ color: 'var(--text-strong)' }}>
                {employee.first_name} {employee.last_name}
              </h2>
            </div>
            <button
              onClick={onClose}
              aria-label="Cerrar panel"
              className="rounded-full p-2 transition-colors"
              style={{ color: 'var(--text-light)' }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-elevated)'; e.currentTarget.style.color = 'var(--text-strong)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-light)' }}
            >
              <X size={24} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-8">
            {/* Status & Clock */}
            <div className="flex items-center justify-between app-surface p-5">
              <div className="space-y-1">
                <p className="section-label">Estado Actual</p>
                <div className="flex items-center gap-2">
                  <EmployeeStatusBadge status={employee.current_status} className="scale-110 origin-left" />
                </div>
              </div>
              <div className="text-right">
                <p className="section-label">Hora Servidor</p>
                <DigitalClock className="text-xl font-black tracking-tight" style={{ color: 'var(--text-strong)' }} />
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
                color="bg-[var(--bg-elevated)] hover:bg-[var(--border-soft)] border border-[var(--border-medium)]"
                onClick={() => handleAction('CLOCK_OUT')}
                disabled={employee.current_status === 'offline' || isSubmitting}
              />
            </div>

            {/* Incident Form */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 border-b pb-3" style={{ borderColor: 'var(--border-soft)' }}>
                <AlertCircle size={16} style={{ color: 'var(--primary)' }} />
                <h3 className="text-[11px] font-black uppercase tracking-widest" style={{ color: 'var(--text-strong)' }}>Registrar Incidencia / Notas</h3>
              </div>

              <div className="space-y-3">
                <select
                  value={incidenteType}
                  onChange={(e) => setIncidenteType(e.target.value)}
                  className="input-dark h-12 w-full px-4 text-sm"
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
                  className="input-dark h-32 w-full p-4 text-sm resize-none"
                />

                <div className="flex gap-2">
                  <button className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-dashed p-4 text-[11px] font-black uppercase tracking-widest transition"
                    style={{ borderColor: 'var(--border-soft)', color: 'var(--text-light)' }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--primary)'; e.currentTarget.style.color = 'var(--primary)' }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-soft)'; e.currentTarget.style.color = 'var(--text-light)' }}
                  >
                    <Camera size={16} />
                    Foto
                  </button>
                  <button className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-dashed p-4 text-[11px] font-black uppercase tracking-widest transition"
                    style={{ borderColor: 'var(--border-soft)', color: 'var(--text-light)' }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--primary)'; e.currentTarget.style.color = 'var(--primary)' }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-soft)'; e.currentTarget.style.color = 'var(--text-light)' }}
                  >
                    <FileText size={16} />
                    PDF
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="border-t p-6 flex gap-3" style={{ borderColor: 'var(--border-soft)', background: 'var(--bg-app)' }}>
            <button
              onClick={onClose}
              className="flex-1 rounded-xl border px-4 py-3 text-[11px] font-black uppercase tracking-widest transition-colors"
              style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-soft)', color: 'var(--text-muted)' }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-elevated)'; e.currentTarget.style.color = 'var(--text-strong)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg-surface)'; e.currentTarget.style.color = 'var(--text-muted)' }}
            >
              Cancelar
            </button>
            <button
              disabled={isSubmitting || !notes}
              onClick={() => handleAction('NOTE_ONLY')}
              className="flex-1 rounded-xl px-4 py-3 text-[11px] font-black uppercase tracking-widest text-white transition-all disabled:opacity-40"
              style={{ background: 'var(--primary)', boxShadow: '0 0 20px var(--primary-soft)' }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--primary-hover)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'var(--primary)' }}
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
