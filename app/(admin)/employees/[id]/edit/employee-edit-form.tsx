'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import { updateEmployee, type ActionState } from '../../../../actions/employees'

interface EmployeeEditFormProps {
  employee: {
    id: string
    first_name: string
    last_name: string
    email: string | null
    branch_id: string
    is_active: boolean
  }
  branches: { id: string; name: string }[]
}

export function EmployeeEditForm({ employee, branches }: EmployeeEditFormProps) {
  const updateEmployeeWithId = updateEmployee.bind(null, employee.id)
  const [state, action, pending] = useActionState<ActionState, FormData>(updateEmployeeWithId, null)

  return (
    <form action={action} className="space-y-6">
      {state?.error && (
        <div className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-600 ring-1 ring-red-200">
          {state.error}
        </div>
      )}

      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <label className="mb-2 block text-sm font-semibold text-slate-900">
            Nombres *
          </label>
          <input
            type="text"
            name="first_name"
            defaultValue={employee.first_name}
            required
            placeholder="Ej. Juan Carlos"
            className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-semibold text-slate-900">
            Apellidos *
          </label>
          <input
            type="text"
            name="last_name"
            defaultValue={employee.last_name}
            required
            placeholder="Ej. Pérez Gómez"
            className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
          />
        </div>
        
        <div className="sm:col-span-2">
          <label className="mb-2 block text-sm font-semibold text-slate-900">
            Correo electrónico
          </label>
          <input
            type="email"
            name="email"
            defaultValue={employee.email ?? ''}
            placeholder="correo@empresa.com"
            className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
          />
        </div>

        <div className="sm:col-span-1">
          <label className="mb-2 block text-sm font-semibold text-slate-900">
            Teléfono
          </label>
          <input
            type="tel"
            name="phone"
            defaultValue={employee.phone ?? ''}
            placeholder="+505 0000 0000"
            className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
          />
        </div>

        <div className="sm:col-span-1">
          <label className="mb-2 block text-sm font-semibold text-slate-900">
            Fecha de ingreso
          </label>
          <input
            type="date"
            name="hire_date"
            defaultValue={employee.hire_date ? new Date(employee.hire_date).toISOString().split('T')[0] : ''}
            className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
          />
        </div>

        <div>
           <label className="mb-2 block text-sm font-semibold text-slate-900">
            Sucursal asignada *
          </label>
          <select
            name="branch_id"
            defaultValue={employee.branch_id}
            required
            className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
          >
            <option value="">Selecciona una sucursal...</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-3 space-y-0 pt-6">
          <input
            type="checkbox"
            id="is_active"
            name="is_active"
            defaultChecked={employee.is_active}
            className="h-5 w-5 rounded-lg border-slate-200 text-slate-900 focus:ring-slate-900"
          />
          <label htmlFor="is_active" className="text-sm font-semibold text-slate-900">
            Colaborador Activo
          </label>
        </div>
      </div>

      <div className="pt-4 flex justify-end gap-3 border-t border-slate-100">
        <Link
          href={`/employees/${employee.id}`}
          className="flex h-12 items-center justify-center rounded-2xl px-6 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
        >
          Cancelar
        </Link>
        <button
          type="submit"
          disabled={pending}
          className="flex h-12 items-center justify-center rounded-2xl bg-slate-900 px-8 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-50"
        >
          {pending ? 'Guardando...' : 'Guardar cambios'}
        </button>
      </div>
    </form>
  )
}
