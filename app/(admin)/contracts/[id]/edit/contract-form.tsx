'use client'

import { useState, useActionState } from 'react'
import Link from 'next/link'
import { updateContract, annulContract, deleteContract, type ContractActionState } from '../../../../actions/contracts'
import { useRouter } from 'next/navigation'
import { useTransition } from 'react'

type Shift = {
  id: string
  name: string
  start_time: string
  end_time: string
}

type JobPosition = {
  id: string
  name: string
  company_id: string
  parent_id: string | null
}

interface ContractFormProps {
  id: string
  initialData: any
  shifts: Shift[]
  jobPositions: JobPosition[]
}

export function ContractForm({ id, initialData, shifts, jobPositions }: ContractFormProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [selectedShift, setSelectedShift] = useState<string>(initialData.schedule_id || '')
  const [state, action, pending] = useActionState<ContractActionState, FormData>(
    updateContract.bind(null, id),
    null
  )

  const [selectedPosition, setSelectedPosition] = useState<string>(initialData.employees?.job_position_id || '')
  const selectedJob = jobPositions.find(p => p.id === selectedPosition)
  const parentJob = jobPositions.find(p => p.id === selectedJob?.parent_id)

  const handleAnnul = async () => {
    if (!confirm('¿Estás seguro de anular este contrato? Esta acción lo marcará como no activo.')) return
    startTransition(async () => {
      const res = await annulContract(id)
      if (res.error) alert(res.error)
      else router.push('/contracts')
    })
  }

  const handleDelete = async () => {
    if (!confirm('¿Estás seguro de ELIMINAR permanentemente este contrato?')) return
    startTransition(async () => {
      const res = await deleteContract(id)
      if (res.error) alert(res.error)
      else router.push('/contracts')
    })
  }

  return (
    <form action={action} className="space-y-8">
      {state?.error && (
        <div className="rounded-2xl bg-red-50 p-4 text-sm text-red-600 ring-1 ring-red-200">
          {state.error}
        </div>
      )}

      <div className="grid gap-8 lg:grid-cols-2">
        {/* Basic Info */}
        <div className="space-y-6">
          <h2 className="text-lg font-bold text-slate-900">Información General</h2>
          <div className="grid gap-4">
            <div>
              <label className="mb-2 block text-sm font-bold text-slate-900 uppercase tracking-tight">Tipo de Contrato</label>
              <select 
                name="contract_type" 
                defaultValue={initialData.contract_type}
                className="h-12 w-full rounded-2xl border-2 border-slate-300 bg-white px-4 text-sm font-bold text-slate-900 outline-none focus:border-slate-900"
              >
                <option value="Indefinido">Indefinido</option>
                <option value="Temporal">Temporal (Obra/Servicio)</option>
                <option value="Servicios Prof.">Servicios Profesionales</option>
                <option value="Pasantía">Pasantía</option>
              </select>
            </div>
            <div>
              <label className="mb-2 block text-sm font-bold text-slate-900 uppercase tracking-tight">Salario Mensual</label>
              <input 
                type="number" 
                name="salary" 
                defaultValue={initialData.salary}
                className="h-12 w-full rounded-2xl border-2 border-slate-300 bg-white px-4 text-sm font-bold text-slate-900 outline-none focus:border-slate-900" 
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-bold text-slate-900 uppercase tracking-tight">Estado</label>
              <select 
                name="status" 
                defaultValue={initialData.status}
                className="h-12 w-full rounded-2xl border-2 border-slate-300 bg-white px-4 text-sm font-bold text-slate-900 outline-none focus:border-slate-900"
              >
                <option value="active">Activo</option>
                <option value="annulled">Anulado</option>
                <option value="expired">Vencido</option>
                <option value="terminated">Terminado</option>
              </select>
            </div>
            <div>
              <label className="mb-2 block text-sm font-bold text-slate-900 uppercase tracking-tight text-left">Puesto de Trabajo</label>
              <select 
                name="job_position_id" 
                value={selectedPosition}
                onChange={(e) => setSelectedPosition(e.target.value)}
                className="h-12 w-full rounded-2xl border-2 border-slate-300 bg-white px-4 text-sm font-bold text-slate-900 outline-none focus:border-slate-900"
                required
              >
                <option value="">Seleccionar puesto</option>
                {jobPositions.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
              {selectedPosition && parentJob && (
                <div className="mt-2 flex items-center gap-2 rounded-xl bg-indigo-50 px-3 py-2 border border-indigo-100 animate-in fade-in transition-all">
                  <svg className="h-3 w-3 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M7 11l5-5m0 0l5 5m-5-5v12" />
                  </svg>
                  <span className="text-[10px] font-bold uppercase text-indigo-700">Reporta a: {parentJob.name}</span>
                </div>
              )}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 pt-2">
            <div>
              <label className="mb-2 block text-sm font-bold text-slate-900 uppercase tracking-tight">Fecha Inicio</label>
              <input 
                type="date" 
                name="start_date" 
                defaultValue={initialData.start_date}
                className="h-12 w-full rounded-2xl border-2 border-slate-300 bg-white px-4 text-sm font-bold text-slate-900 outline-none focus:border-slate-900" 
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-bold text-slate-900 uppercase tracking-tight">Fecha Fin</label>
              <input 
                type="date" 
                name="end_date" 
                defaultValue={initialData.end_date}
                className="h-12 w-full rounded-2xl border-2 border-slate-300 bg-white px-4 text-sm font-bold text-slate-900 outline-none focus:border-slate-900" 
              />
            </div>
          </div>
        </div>

        {/* Shift Selection */}
        <div className="space-y-6">
          <h2 className="text-lg font-bold text-slate-900">Horario Asignado</h2>
          <div className="grid gap-3 max-h-[400px] overflow-y-auto pr-2">
            {shifts.map((shift) => (
              <label 
                key={shift.id}
                className={`flex cursor-pointer items-center gap-4 rounded-2xl border-2 p-4 transition shadow-sm ${
                  selectedShift === shift.id 
                    ? 'border-slate-900 bg-slate-50 ring-1 ring-slate-900' 
                    : 'border-slate-200 hover:bg-slate-50'
                }`}
              >
                <input 
                  type="radio" 
                  name="schedule_id" 
                  value={shift.id} 
                  checked={selectedShift === shift.id}
                  onChange={() => setSelectedShift(shift.id)}
                  className="h-6 w-6 accent-slate-900" 
                />
                <div className="flex-1">
                  <p className="font-bold text-slate-900">{shift.name}</p>
                  <p className="text-xs font-mono text-slate-500 uppercase">
                    {shift.start_time.substring(0,5)} - {shift.end_time.substring(0,5)}
                  </p>
                </div>
              </label>
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-3 pt-6 border-t border-slate-100">
        <Link 
          href={`/contracts/${id}/print`}
          className="rounded-2xl border-2 border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50 flex items-center gap-2"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
          </svg>
          Generar PDF
        </Link>

        {initialData.status !== 'annulled' && (
          <button
            type="button"
            onClick={handleAnnul}
            disabled={isPending}
            className="rounded-2xl border-2 border-orange-200 bg-orange-50 px-5 py-3 text-sm font-bold text-orange-700 transition hover:bg-orange-100 disabled:opacity-50"
          >
            Anular
          </button>
        )}

        <button
          type="button"
          onClick={handleDelete}
          disabled={isPending || initialData.is_printed}
          className="rounded-2xl border-2 border-red-200 bg-red-50 px-5 py-3 text-sm font-bold text-red-700 transition hover:bg-red-100 disabled:opacity-50"
          title={initialData.is_printed ? "No se puede eliminar un contrato impreso" : "Eliminar permanentemente"}
        >
          Eliminar
        </button>

        <div className="flex-1 lg:hidden" />

        <Link 
          href="/contracts" 
          className="rounded-2xl border-2 border-slate-100 px-6 py-3 text-sm font-bold text-slate-400 transition hover:bg-slate-50"
        >
          Cancelar
        </Link>
        <button
          type="submit"
          disabled={pending || isPending}
          className="rounded-2xl bg-slate-900 px-10 py-3 text-sm font-bold text-white shadow-xl transition hover:bg-slate-800 disabled:opacity-50"
        >
          {pending ? 'Guardando...' : 'Guardar Cambios'}
        </button>
      </div>
    </form>
  )
}
