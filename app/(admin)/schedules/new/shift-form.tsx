'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import { createShift, type ActionState } from '../../../actions/schedules'

export function ShiftForm() {
  const [state, action, pending] = useActionState<ActionState, FormData>(createShift, null)

  return (
    <form action={action} className="space-y-6">
      {state?.error && (
        <div className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-600 ring-1 ring-red-200">
          {state.error}
        </div>
      )}

      <div className="grid gap-6 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="mb-2 block text-sm font-semibold text-slate-900">
            Nombre del turno *
          </label>
          <input
            type="text"
            name="name"
            required
            placeholder="Ej. Matutino Regular"
            className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-semibold text-slate-900">
            Hora de entrada *
          </label>
          <input
            type="time"
            name="start_time"
            required
            className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-semibold text-slate-900">
            Hora de salida *
          </label>
          <input
            type="time"
            name="end_time"
            required
            className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-semibold text-slate-900">
            Minutos de descanso
          </label>
          <input
            type="number"
            name="break_minutes"
            defaultValue="60"
            min="0"
            className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
          />
          <p className="mt-2 text-xs text-slate-500">Tiempo para almuerzo/break.</p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-900">
              Tol. Entrada (min)
            </label>
            <input
              type="number"
              name="tolerance_in"
              defaultValue="5"
              min="0"
              className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-900">
              Tol. Salida (min)
            </label>
            <input
              type="number"
              name="tolerance_out"
              defaultValue="0"
              min="0"
              className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
            />
          </div>
        </div>

        <div className="sm:col-span-2">
          <label className="mb-3 block text-sm font-semibold text-slate-900">
            Días de la semana
          </label>
          <div className="flex flex-wrap gap-2">
            {[
              { id: 1, label: 'Lu' },
              { id: 2, label: 'Ma' },
              { id: 3, label: 'Mi' },
              { id: 4, label: 'Ju' },
              { id: 5, label: 'Vi' },
              { id: 6, label: 'Sa' },
              { id: 0, label: 'Do' },
            ].map((day) => (
              <label
                key={day.id}
                className="relative flex cursor-pointer items-center justify-center rounded-xl bg-slate-50 px-4 py-2 ring-1 ring-slate-200 transition-all hover:bg-slate-100 has-[:checked]:bg-slate-900 has-[:checked]:text-white has-[:checked]:ring-slate-900"
              >
                <input
                  type="checkbox"
                  name="days_of_week"
                  value={day.id}
                  defaultChecked={day.id >= 1 && day.id <= 5}
                  className="sr-only"
                />
                <span className="text-xs font-bold">{day.label}</span>
              </label>
            ))}
          </div>
          <p className="mt-2 text-xs text-slate-500">Seleccione los días laborales para este turno.</p>
        </div>
      </div>

      <div className="pt-4 flex justify-end gap-3 border-t border-slate-100">
        <Link
          href="/schedules"
          className="flex h-12 items-center justify-center rounded-2xl px-6 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
        >
          Cancelar
        </Link>
        <button
          type="submit"
          disabled={pending}
          className="flex h-12 items-center justify-center rounded-2xl bg-slate-900 px-8 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-50"
        >
          {pending ? 'Guardando...' : 'Guardar turno'}
        </button>
      </div>
    </form>
  )
}
