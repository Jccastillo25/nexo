'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import { createEmployee, type ActionState } from '../../../actions/employees'

export function EmployeeForm({ 
  branches,
  positions,
  templates
}: { 
  branches: { id: string; name: string }[],
  positions: { id: string; name: string }[],
  templates: { id: string; name: string }[]
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(createEmployee, null)

  return (
    <form action={action} className="space-y-6">
      {state?.error && (
        <div className="rounded-2xl bg-red-500/10 px-4 py-3 text-xs font-bold text-red-400 border border-red-500/20">
          {state.error}
        </div>
      )}

      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <label className="mb-2 block text-[10px] font-black uppercase tracking-widest text-slate-400">
            Nombres *
          </label>
          <input
            type="text"
            name="first_name"
            required
            placeholder="Ej. Juan Carlos"
            className="h-12 w-full rounded-2xl border border-slate-700 bg-slate-800/50 px-4 text-sm text-white outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 placeholder:text-slate-500"
          />
        </div>

        <div>
          <label className="mb-2 block text-[10px] font-black uppercase tracking-widest text-slate-400">
            Apellidos *
          </label>
          <input
            type="text"
            name="last_name"
            required
            placeholder="Ej. Pérez Gómez"
            className="h-12 w-full rounded-2xl border border-slate-700 bg-slate-800/50 px-4 text-sm text-white outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 placeholder:text-slate-500"
          />
        </div>
        
        <div className="sm:col-span-2">
          <label className="mb-2 block text-[10px] font-black uppercase tracking-widest text-slate-400">
            Correo electrónico
          </label>
          <input
            type="email"
            name="email"
            placeholder="correo@empresa.com"
            className="h-12 w-full rounded-2xl border border-slate-700 bg-slate-800/50 px-4 text-sm text-white outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 placeholder:text-slate-500"
          />
        </div>

        <div>
          <label className="mb-2 block text-[10px] font-black uppercase tracking-widest text-slate-400">
            Código PIN de acceso
          </label>
          <div className="flex h-12 w-full items-center rounded-2xl border border-dashed border-slate-700 bg-slate-800/30 px-4 text-sm font-medium text-slate-500">
            Se generará automáticamente al guardar
          </div>
          <p className="mt-2 text-xs text-slate-500">
            El sistema asignará un PIN único de 4 dígitos para el kiosko.
          </p>
        </div>

        <div>
           <label className="mb-2 block text-[10px] font-black uppercase tracking-widest text-slate-400">
            Sucursal (Opcional)
          </label>
          <select
            name="branch_id"
            className="h-12 w-full rounded-2xl border border-slate-700 bg-slate-800/50 px-4 text-sm text-white outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
          >
            <option value="">Sin asignar (Candidato)</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>

        <div>
           <label className="mb-2 block text-[10px] font-black uppercase tracking-widest text-slate-400">
            Puesto de Trabajo
          </label>
          <select
            name="job_position_id"
            className="h-12 w-full rounded-2xl border border-slate-700 bg-slate-800/50 px-4 text-sm text-white outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
          >
            <option value="">Selecciona un puesto</option>
            {positions.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        <div className="sm:col-span-2">
           <label className="mb-2 block text-[10px] font-black uppercase tracking-widest text-slate-400">
            Turno / Horario Base
          </label>
          <select
            name="shift_template_id"
            className="h-12 w-full rounded-2xl border border-slate-700 bg-slate-800/50 px-4 text-sm text-white outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
          >
            <option value="">Sin turno asignado (Personalizable)</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          <p className="mt-2 text-xs text-slate-500">
            El turno seleccionado aplicará como patrón base para todos los días laborales.
          </p>
        </div>
      </div>

      <div className="pt-4 flex justify-end gap-3 border-t border-slate-700/50">
        <Link
          href="/employees"
          className="flex h-12 items-center justify-center rounded-2xl px-6 text-[11px] font-black uppercase tracking-widest text-slate-400 border border-transparent transition hover:border-slate-700 hover:text-white"
        >
          Cancelar
        </Link>
        <button
          type="submit"
          disabled={pending}
          className="flex h-12 items-center justify-center rounded-2xl bg-blue-500 px-8 text-[11px] font-black uppercase tracking-widest text-white shadow-lg shadow-blue-500/20 transition-all hover:bg-blue-600 hover:shadow-blue-500/40 hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:pointer-events-none"
        >
          {pending ? 'Aplicando...' : 'Crear colaborador'}
        </button>
      </div>
    </form>
  )
}
