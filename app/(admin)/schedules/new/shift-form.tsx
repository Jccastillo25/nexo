'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import { createShift, updateShift, type ActionState } from '../../../actions/schedules'

export function ShiftForm({ 
  initialData, 
  id 
}: { 
  initialData?: any, 
  id?: string 
}) {
  const actionWithId = id ? updateShift.bind(null, id) : createShift
  const [state, action, pending] = useActionState<ActionState, FormData>(actionWithId as any, null)

  return (
    <form action={action} className="space-y-6">
      {state?.error && (
        <div className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-600 ring-1 ring-red-200">
          {state.error}
        </div>
      )}

      <div className="grid gap-6 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="mb-2 block text-sm font-bold text-slate-900">
            Nombre del turno *
          </label>
          <input
            type="text"
            name="name"
            required
            defaultValue={initialData?.name}
            placeholder="Ej. Matutino Regular"
            className="h-12 w-full rounded-2xl border-2 border-slate-300 bg-white px-4 text-sm font-bold text-slate-900 outline-none transition focus:border-slate-900"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-bold text-slate-900">
            Hora de entrada *
          </label>
          <input
            type="time"
            name="start_time"
            required
            defaultValue={initialData?.start_time}
            className="h-12 w-full rounded-2xl border-2 border-slate-300 bg-white px-4 text-sm font-bold text-slate-900 outline-none transition focus:border-slate-900"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-bold text-slate-900">
            Hora de salida *
          </label>
          <input
            type="time"
            name="end_time"
            required
            defaultValue={initialData?.end_time}
            className="h-12 w-full rounded-2xl border-2 border-slate-300 bg-white px-4 text-sm font-bold text-slate-900 outline-none transition focus:border-slate-900"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-bold text-slate-900">
            Minutos de descanso
          </label>
          <input
            type="number"
            name="break_minutes"
            defaultValue={initialData?.break_minutes ?? "60"}
            min="0"
            className="h-12 w-full rounded-2xl border-2 border-slate-300 bg-white px-4 text-sm font-bold text-slate-900 outline-none transition focus:border-slate-900"
          />
          <p className="mt-2 text-xs font-medium text-slate-500">Tiempo para almuerzo/break.</p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-2 block text-sm font-bold text-slate-900">
              Tol. Entrada (min)
            </label>
            <input
              type="number"
              name="tolerance_in"
              defaultValue={initialData?.tolerance_in ?? "5"}
              min="0"
              className="h-12 w-full rounded-2xl border-2 border-slate-300 bg-white px-4 text-sm font-bold text-slate-900 outline-none transition focus:border-slate-900"
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-bold text-slate-900">
              Tol. Salida (min)
            </label>
            <input
              type="number"
              name="tolerance_out"
              defaultValue={initialData?.tolerance_out ?? "0"}
              min="0"
              className="h-12 w-full rounded-2xl border-2 border-slate-300 bg-white px-4 text-sm font-bold text-slate-900 outline-none transition focus:border-slate-900"
            />
          </div>
        </div>

        <div className="sm:col-span-2">
          <label className="mb-3 block text-sm font-bold text-slate-900">
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
                className="relative flex h-12 w-12 cursor-pointer items-center justify-center rounded-2xl border-2 border-slate-200 bg-white ring-slate-900 transition-all hover:bg-slate-50 has-[:checked]:bg-slate-900 has-[:checked]:text-white has-[:checked]:border-slate-900"
              >
                <input
                  type="checkbox"
                  name="days_of_week"
                  value={day.id}
                  defaultChecked={initialData ? initialData.days_of_week?.includes(day.id) : (day.id >= 1 && day.id <= 5)}
                  className="sr-only"
                />
                <span className="text-xs font-black">{day.label}</span>
              </label>
            ))}
          </div>
          <p className="mt-2 text-xs font-medium text-slate-500">Seleccione los días laborales para este turno.</p>
        </div>

        {id && (
          <div className="sm:col-span-2">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                name="is_active"
                defaultChecked={initialData?.is_active ?? true}
                className="h-5 w-5 rounded border-2 border-slate-300 text-slate-900 focus:ring-slate-900"
              />
              <span className="text-sm font-bold text-slate-900">Turno activo</span>
            </label>
          </div>
        )}
      </div>

      <div className="pt-6 flex justify-end gap-3 border-t border-slate-100">
        <Link
          href="/schedules"
          className="flex h-12 items-center justify-center rounded-2xl px-6 text-sm font-bold text-slate-700 transition hover:bg-slate-100"
        >
          Cancelar
        </Link>
        <button
          type="submit"
          disabled={pending}
          className="flex h-12 items-center justify-center rounded-2xl bg-slate-900 px-10 text-sm font-bold text-white shadow-xl shadow-slate-200 transition hover:bg-slate-800 disabled:opacity-50"
        >
          {pending ? 'Guardando...' : id ? 'Actualizar turno' : 'Guardar turno'}
        </button>
      </div>
    </form>
  )
}
