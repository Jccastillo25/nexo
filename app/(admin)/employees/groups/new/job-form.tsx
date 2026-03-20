'use client'

import { useActionState } from 'react'
import { createJobPosition, type JobActionState } from '../../../../actions/jobs'
import { Save, ArrowLeft } from 'lucide-react'
import Link from 'next/link'

export function JobPositionForm({ 
  companies, 
  existingPositions 
}: { 
  companies: any[]
  existingPositions: any[]
}) {
  const [state, action, pending] = useActionState<JobActionState, FormData>(createJobPosition, null)

  return (
    <form action={action} className="space-y-6">
      {state?.error && (
        <div className="rounded-2xl bg-red-50 p-4 text-sm text-red-600 ring-1 ring-red-200">
          {state.error}
        </div>
      )}

      <div className="grid gap-6 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="mb-2 block text-sm font-bold text-slate-900 text-left">Nombre del Puesto</label>
          <input 
            type="text" 
            name="name" 
            placeholder="Ej: Gerente de Ventas" 
            required
            className="h-12 w-full rounded-2xl border-2 border-slate-200 bg-white px-4 text-sm font-bold text-slate-900 outline-none focus:border-slate-900" 
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-bold text-slate-900 text-left">Empresa</label>
          <select 
            name="company_id" 
            required
            className="h-12 w-full rounded-2xl border-2 border-slate-200 bg-white px-4 text-sm font-bold text-slate-900 outline-none focus:border-slate-900"
          >
            <option value="">Seleccionar empresa</option>
            {companies.map(c => (
              <option key={c.id} value={c.id}>{c.display_name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-2 block text-sm font-bold text-slate-900 text-left">Descanso Reglamentario (min)</label>
          <input 
            type="number" 
            name="default_break_mins" 
            defaultValue="60"
            className="h-12 w-full rounded-2xl border-2 border-slate-200 bg-white px-4 text-sm font-bold text-slate-900 outline-none focus:border-slate-900" 
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-bold text-slate-900 text-left">Nivel Jerárquico</label>
          <input 
            type="number" 
            name="level" 
            step="0.1"
            defaultValue="1"
            className="h-12 w-full rounded-2xl border-2 border-slate-200 bg-white px-4 text-sm font-bold text-slate-900 outline-none focus:border-slate-900" 
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-bold text-slate-900 text-left">Reporta a (Jefe Directo)</label>
          <select 
            name="parent_id" 
            className="h-12 w-full rounded-2xl border-2 border-slate-200 bg-white px-4 text-sm font-bold text-slate-900 outline-none focus:border-slate-900"
          >
            <option value="none">Nadie (Nivel Raíz)</option>
            {existingPositions.map(p => (
              <option key={p.id} value={p.id}>{p.name} (Nivel {p.level})</option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex items-center justify-end gap-3 pt-6 border-t border-slate-100">
        <Link href="/employees/groups" className="flex h-12 items-center justify-center rounded-2xl px-6 text-sm font-bold text-slate-500 transition hover:bg-slate-100">
          Cancelar
        </Link>
        <button 
          type="submit" 
          disabled={pending}
          className="flex h-12 items-center gap-2 rounded-2xl bg-slate-900 px-8 text-sm font-bold text-white shadow-xl transition hover:bg-slate-800 disabled:opacity-50 active:scale-95"
        >
          <Save className="h-4 w-4" />
          {pending ? 'Guardando...' : 'Crear Puesto'}
        </button>
      </div>
    </form>
  )
}
