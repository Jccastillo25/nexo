'use client'

import { useActionState, useEffect, useState } from 'react'
import Link from 'next/link'
import { createBranch, type ActionState } from '../../../../actions/branches'
import { createClient } from '@/lib/supabase/client'

export function BranchForm({ companies }: { companies: { id: string; display_name: string; slug: string }[] }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(createBranch, null)
  const [companyId, setCompanyId] = useState('')
  const [name, setName] = useState('')
  const [code, setCode] = useState('')

  useEffect(() => {
    if (!companyId) {
      setCode('')
      return
    }

    const company = companies.find(c => c.id === companyId)
    if (!company) return

    const generateCode = async () => {
      const supabase = createClient()
      const { count } = await supabase
        .from('branches')
        .select('*', { count: 'exact', head: true })
        .eq('company_id', companyId)
      
      const nextNum = (count ?? 0) + 1
      const paddedNum = nextNum.toString().padStart(2, '0')
      setCode(`${company.slug.toLowerCase()}-suc-${paddedNum}`)
    }

    generateCode()
  }, [companyId, companies])

  return (
    <form action={action} className="space-y-6">
      {state?.error && (
        <div className="rounded-2xl bg-red-500/10 px-4 py-3 text-xs font-bold text-red-400 border border-red-500/20">
          {state.error}
        </div>
      )}

      <div className="grid gap-6 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="mb-2 block text-[10px] font-black uppercase tracking-widest text-slate-400">
            Empresa a la que pertenece *
          </label>
          <select
            name="company_id"
            required
            value={companyId}
            onChange={(e) => setCompanyId(e.target.value)}
            className="h-12 w-full rounded-2xl border border-slate-700 bg-slate-800/50 px-4 text-sm text-white outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
          >
            <option value="">Selecciona una empresa...</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.display_name}
              </option>
            ))}
          </select>
        </div>

        <div className="sm:col-span-2">
          <label className="mb-2 block text-[10px] font-black uppercase tracking-widest text-slate-400">
            Nombre de la sucursal *
          </label>
          <input
            type="text"
            name="name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ej. Oficina Central"
            className="h-12 w-full rounded-2xl border border-slate-700 bg-slate-800/50 px-4 text-sm text-white placeholder:text-slate-500 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
          />
        </div>

        <div className="sm:col-span-2">
          <label className="mb-2 block text-[10px] font-black uppercase tracking-widest text-slate-400">
            Código interno (Opcional)
          </label>
          <input
            type="text"
            name="code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Ej. SUC-01"
            className="h-12 w-full rounded-2xl border border-slate-700 bg-slate-800/50 px-4 text-sm text-white placeholder:text-slate-500 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
          />
          <p className="mt-2 text-[11px] font-medium text-slate-500">
            Identificador corto para reportes. Se genera automáticamente según el slug de la empresa.
          </p>
        </div>

        <div className="sm:col-span-2">
          <label className="mb-2 block text-[10px] font-black uppercase tracking-widest text-slate-400">
            Dirección (Opcional)
          </label>
          <textarea
            name="address"
            placeholder="Dirección completa de la sucursal"
            rows={3}
            className="w-full rounded-2xl border border-slate-700 bg-slate-800/50 px-4 py-3 text-sm text-white placeholder:text-slate-500 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
          />
        </div>
      </div>

      <div className="pt-4 flex justify-end gap-3 border-t border-slate-700/50">
        <Link
          href="/organization/branches"
          className="flex h-12 items-center justify-center rounded-2xl px-6 text-[11px] font-black uppercase tracking-widest text-slate-400 border border-transparent transition hover:border-slate-700 hover:text-white"
        >
          Cancelar
        </Link>
        <button
          type="submit"
          disabled={pending}
          className="flex h-12 items-center justify-center rounded-2xl bg-blue-500 px-8 text-[11px] font-black uppercase tracking-widest text-white shadow-lg shadow-blue-500/20 transition-all hover:bg-blue-600 hover:shadow-blue-500/40 hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:pointer-events-none"
        >
          {pending ? 'Guardando...' : 'Guardar sucursal'}
        </button>
      </div>
    </form>
  )
}
