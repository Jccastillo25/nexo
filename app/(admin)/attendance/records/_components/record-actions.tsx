'use client'

import { useState, useTransition } from 'react'
import { Edit2, Trash2, X, Save, AlertTriangle } from 'lucide-react'
import { updateAttendanceLog, deleteAttendanceLog } from '../../../../actions/attendance'

type RecordContext = {
  id: string
  clockInOrigin: string
  clockOutOrigin: string | null
  statusOrigin: string
  employeeName: string
}

export function RecordActions({ record }: { record: RecordContext }) {
  const [isEditing, setIsEditing] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  
  const [isPending, startTransition] = useTransition()

  const [clockIn, setClockIn] = useState(record.clockInOrigin.slice(0, 16)) // Format YYYY-MM-DDTHH:mm
  const [clockOut, setClockOut] = useState(record.clockOutOrigin ? record.clockOutOrigin.slice(0, 16) : '')
  const [status, setStatus] = useState(record.statusOrigin)

  const handleUpdate = () => {
    startTransition(async () => {
      const data: any = { status }
      if (clockIn) data.clock_in = new Date(clockIn).toISOString()
      if (clockOut) data.clock_out = new Date(clockOut).toISOString()
      
      const res = await updateAttendanceLog(record.id, data)
      if (res.error) alert(res.error)
      else setIsEditing(false)
    })
  }

  const handleDelete = () => {
    startTransition(async () => {
      const res = await deleteAttendanceLog(record.id)
      if (res.error) alert(res.error)
      else setIsDeleting(false)
    })
  }

  return (
    <>
      <div className="flex items-center gap-2">
        <button
          onClick={() => setIsEditing(true)}
          className="rounded-lg p-2 text-slate-400 hover:bg-blue-50 hover:text-blue-600 transition"
          title="Editar Jornada"
        >
          <Edit2 className="h-4 w-4" />
        </button>
        <button
          onClick={() => setIsDeleting(true)}
          className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600 transition"
          title="Eliminar Registro"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      {/* Edit Modal */}
      {isEditing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md animate-in zoom-in-95 rounded-3xl bg-white p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-slate-900">Editar Jornada</h3>
            <p className="mt-1 mb-4 text-sm text-slate-500">
              Corrigiendo el registro de <span className="font-semibold text-slate-900">{record.employeeName}</span>
            </p>

            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-bold uppercase text-slate-500">Hora de Entrada</label>
                <input
                  type="datetime-local"
                  value={clockIn}
                  onChange={e => setClockIn(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 p-3 text-sm outline-none focus:border-slate-900"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold uppercase text-slate-500">Hora de Salida</label>
                <input
                  type="datetime-local"
                  value={clockOut}
                  onChange={e => setClockOut(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 p-3 text-sm outline-none focus:border-slate-900"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold uppercase text-slate-500">Estado de Entrada</label>
                <select
                  value={status}
                  onChange={e => setStatus(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 p-3 text-sm outline-none focus:border-slate-900"
                >
                  <option value="on_time">Puntual</option>
                  <option value="late">Retraso</option>
                </select>
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setIsEditing(false)}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-slate-100 p-3 text-sm font-bold text-slate-600 hover:bg-slate-200"
              >
                <X className="h-4 w-4" /> Cancelar
              </button>
              <button
                onClick={handleUpdate}
                disabled={isPending}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-slate-900 p-3 text-sm font-bold text-white hover:bg-slate-800 disabled:opacity-50"
              >
                <Save className="h-4 w-4" /> Guardar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Modal */}
      {isDeleting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm animate-in zoom-in-95 rounded-3xl bg-white p-6 shadow-2xl text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100 text-red-600">
              <AlertTriangle className="h-8 w-8" />
            </div>
            <h3 className="text-xl font-bold text-slate-900">¿Eliminar Registro?</h3>
            <p className="mt-2 text-sm text-slate-500">
              Estás a punto de eliminar permanentemente esta jornada de <span className="font-semibold">{record.employeeName}</span>.
            </p>

            <div className="mt-8 flex gap-3">
              <button
                onClick={() => setIsDeleting(false)}
                className="flex flex-1 items-center justify-center rounded-xl bg-slate-100 p-3 text-sm font-bold text-slate-600 hover:bg-slate-200"
              >
                Mantener
              </button>
              <button
                onClick={handleDelete}
                disabled={isPending}
                className="flex flex-1 items-center justify-center rounded-xl bg-red-600 p-3 text-sm font-bold text-white hover:bg-red-700 disabled:opacity-50"
              >
                Sí, Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
