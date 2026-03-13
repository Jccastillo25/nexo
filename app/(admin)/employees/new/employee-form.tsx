'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import { createEmployee, type ActionState } from '../../../actions/employees'

export function EmployeeForm({ branches }: { branches: { id: string; name: string }[] }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(createEmployee, null)

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
            placeholder="correo@empresa.com"
            className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-semibold text-slate-900">
            Código PIN de acceso *
          </label>
          <input
            type="text"
            name="employee_code"
            required
            placeholder="Ej. 1045"
            className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200 font-mono"
          />
          <p className="mt-2 text-xs text-slate-500">Este PIN lo usará para marcar en el Kiosko.</p>
        </div>

        <div>
           <label className="mb-2 block text-sm font-semibold text-slate-900">
            Sucursal asignada *
          </label>
          <select
            name="branch_id"
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
      </div>

      <div className="pt-4 flex justify-end gap-3 border-t border-slate-100">
        <Link
          href="/employees"
          className="flex h-12 items-center justify-center rounded-2xl px-6 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
        >
          Cancelar
        </Link>
        <button
          type="submit"
          disabled={pending}
          className="flex h-12 items-center justify-center rounded-2xl bg-slate-900 px-8 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-50"
        >
          {pending ? 'Ampliando equipo...' : 'Crear colaborador'}
        </button>
      </div>
    </form>
  )
}
