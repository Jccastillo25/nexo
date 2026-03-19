'use client'

import { useState, useActionState } from 'react'
import Link from 'next/link'
import { updateContract, type ContractActionState } from '../../../../actions/contracts'

type Shift = {
  id: string
  name: string
  start_time: string
  end_time: string
}

interface ContractFormProps {
  id: string
  initialData: any
  shifts: Shift[]
}

export function ContractForm({ id, initialData, shifts }: ContractFormProps) {
  const [selectedShift, setSelectedShift] = useState<string>(initialData.schedule_id || '')
  const [state, action, pending] = useActionState<ContractActionState, FormData>(
    updateContract.bind(null, id),
    null
  )

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
                <option value="expired">Vencido</option>
                <option value="terminated">Terminado</option>
              </select>
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

      <div className="flex items-center justify-end gap-3 pt-6 border-t border-slate-100">
        <Link 
          href="/contracts" 
          className="rounded-2xl border border-slate-200 px-6 py-3 text-sm font-bold text-slate-600 transition hover:bg-slate-50"
        >
          Cancelar
        </Link>
        <button
          type="submit"
          disabled={pending}
          className="rounded-2xl bg-slate-900 px-8 py-3 text-sm font-bold text-white shadow-xl transition hover:bg-slate-800 disabled:opacity-50"
        >
          {pending ? 'Guardando...' : 'Guardar Cambios'}
        </button>
      </div>
    </form>
  )
}
