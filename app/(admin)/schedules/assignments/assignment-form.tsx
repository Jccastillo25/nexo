'use client'

import { useActionState, useState } from 'react'
import { assignShift, type ActionState } from '../../../actions/schedules'
import { formatTo12h } from '@/lib/date-utils'

interface AssignmentFormProps {
  employees: { id: string; first_name: string; last_name: string; branch_id: string }[]
  shifts: { id: string; name: string; start_time: string; end_time: string }[]
  branches: { id: string; name: string }[]
}

export function AssignmentForm({ employees, shifts, branches }: AssignmentFormProps) {
  const [state, action, pending] = useActionState<ActionState, FormData>(assignShift, null)
  const [selectedBranch, setSelectedBranch] = useState<string>('all')

  const filteredEmployees = selectedBranch === 'all' 
    ? employees 
    : employees.filter(e => e.branch_id === selectedBranch)

  return (
    <form action={action} className="space-y-6">
      {state && 'error' in state && state.error && (
        <div className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-600 ring-1 ring-red-200">
          {state.error}
        </div>
      )}

      <div className="grid gap-6 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="mb-2 block text-sm font-semibold text-slate-900">
            Filtrar por Sucursal
          </label>
          <select
            value={selectedBranch}
            onChange={(e) => setSelectedBranch(e.target.value)}
            className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
          >
            <option value="all">Todas las sucursales</option>
            {branches.map(b => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-2 block text-sm font-semibold text-slate-900">
            Empleado *
          </label>
          <select
            name="employee_id"
            required
            className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
          >
            <option value="">Seleccionar empleado...</option>
            {filteredEmployees.map(e => (
              <option key={e.id} value={e.id}>{e.first_name} {e.last_name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-2 block text-sm font-semibold text-slate-900">
            Turno a Asignar *
          </label>
          <select
            name="shift_id"
            required
            className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
          >
            <option value="">Seleccionar turno...</option>
            {shifts.map(s => (
              <option key={s.id} value={s.id}>
                {s.name} ({formatTo12h(s.start_time)} - {formatTo12h(s.end_time)})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-2 block text-sm font-semibold text-slate-900">
            Fecha de Inicio
          </label>
          <input
            type="date"
            name="start_date"
            defaultValue={new Date().toISOString().split('T')[0]}
            className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
          />
        </div>
      </div>

      <div className="pt-4 flex justify-end gap-3 border-t border-slate-100">
        <button
          type="submit"
          disabled={pending}
          className="flex h-12 items-center justify-center rounded-2xl bg-slate-900 px-8 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-50"
        >
          {pending ? 'Asignando...' : 'Asignar Turno'}
        </button>
      </div>
    </form>
  )
}
