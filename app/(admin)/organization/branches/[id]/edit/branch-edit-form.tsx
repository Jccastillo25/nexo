'use client'

import { useActionState, useEffect, useState } from 'react'
import Link from 'next/link'
import { updateBranch, type ActionState } from '../../../../../actions/branches'
import { createClient } from '@/lib/supabase/client'
import { useDirtyState } from '@/hooks/useDirtyState'
import { DirtyStateGuard } from '@/components/ui/DirtyStateGuard'

interface BranchEditFormProps {
  branch: any
  companies: { id: string; display_name: string; slug: string }[]
}

export function BranchEditForm({ branch, companies }: BranchEditFormProps) {
  const updateBranchWithId = updateBranch.bind(null, branch.id)
  const [state, action, pending] = useActionState<ActionState, FormData>(updateBranchWithId, null)
  const [companyId, setCompanyId] = useState(branch.company_id)
  const [name, setName] = useState(branch.name)
  const [code, setCode] = useState(branch.code || '')
  const [autoCode, setAutoCode] = useState(false)

  // Dirty State Guard
  const { 
    isDirty, 
    showExitGuard, 
    handleAttemptClose, 
    cancelExit, 
    confirmExit, 
    checkDirty, 
    resetInitial 
  } = useDirtyState({
    onClose: () => { window.location.href = '/organization/branches' },
    initialState: {
      company_id: branch.company_id,
      name: branch.name,
      code: branch.code || '',
      address: branch.address || '',
      is_active: branch.is_active,
    }
  })

  useEffect(() => {
    // Collecting current state from controlled inputs and defaultValues
    // For address and is_active we need to be careful if they are not tracked in state
    // But name, companyId, and code are already in state.
    // I'll add state for address and isActive to make it robust.
  }, [])

  const generateSlugInitials = (nameStr: string) => {
    if (!nameStr) return ''
    return nameStr
      .trim()
      .split(/\s+/)
      .map(word => word[0])
      .join('')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '')
  }

  const toggleAutoCode = async () => {
    const newAuto = !autoCode
    setAutoCode(newAuto)
    if (newAuto && companyId) {
      const company = companies.find(c => c.id === companyId)
      if (company) {
        const supabase = createClient()
        const { count } = await supabase
          .from('branches')
          .select('*', { count: 'exact', head: true })
          .eq('company_id', companyId)
        
        const nextNum = (count ?? 0) + 1
        const paddedNum = nextNum.toString().padStart(2, '0')
        setCode(`${company.slug.toLowerCase()}-suc-${paddedNum}`)
      }
    }
  }

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
            onChange={(e) => {
              setCompanyId(e.target.value)
              setAutoCode(false)
            }}
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
          <div className="relative">
            <input
              type="text"
              name="code"
              value={code}
              onChange={(e) => {
                setCode(e.target.value)
                setAutoCode(false)
              }}
              placeholder="Ej. gct-suc-01"
              className="h-12 w-full rounded-2xl border border-slate-700 bg-slate-800/50 px-4 text-sm text-white placeholder:text-slate-500 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
            />
            <button
              type="button"
              onClick={toggleAutoCode}
              className={`absolute right-3 top-1/2 -translate-y-1/2 rounded-lg px-2 py-1 text-[10px] font-black uppercase tracking-widest transition ${autoCode ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' : 'bg-slate-700 text-slate-400 border border-slate-600'}`}
            >
              Auto {autoCode ? 'ON' : 'OFF'}
            </button>
          </div>
          <p className="mt-2 text-[11px] font-medium text-slate-500">
            Identificador corto para reportes.
          </p>
        </div>

        <div className="sm:col-span-2">
          <label className="mb-2 block text-[10px] font-black uppercase tracking-widest text-slate-400">
            Dirección (Opcional)
          </label>
          <textarea
            name="address"
            defaultValue={branch.address}
            placeholder="Dirección completa de la sucursal"
            rows={3}
            className="w-full rounded-2xl border border-slate-700 bg-slate-800/50 px-4 py-3 text-sm text-white placeholder:text-slate-500 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
          />
        </div>

        <div className="sm:col-span-2 flex items-center gap-3 pt-2">
          <input
            type="checkbox"
            id="is_active"
            name="is_active"
            defaultChecked={branch.is_active}
            className="h-5 w-5 rounded-lg border-slate-700 bg-slate-800 text-blue-500 focus:ring-blue-500"
          />
          <label htmlFor="is_active" className="text-[10px] font-black uppercase tracking-widest text-white cursor-pointer">
            Sucursal Activa
          </label>
        </div>
      </div>

      <div className="pt-6 flex justify-end gap-3 border-t border-slate-700/50">
        <Link
          href="/organization/branches"
          onClick={(e) => {
            const fd = new FormData(e.currentTarget.closest('form')!)
            const current = {
              company_id: companyId,
              name,
              code,
              address: fd.get('address') as string,
              is_active: fd.get('is_active') === 'on',
            }
            if (checkDirty(current)) {
              e.preventDefault()
              handleAttemptClose()
            }
          }}
          className="flex h-12 items-center justify-center rounded-2xl px-6 text-[11px] font-black uppercase tracking-widest text-slate-400 border border-transparent transition hover:border-slate-700 hover:text-white"
        >
          Cancelar
        </Link>
        <button
          type="submit"
          disabled={pending}
          className="flex h-12 items-center justify-center rounded-2xl bg-blue-500 px-8 text-[11px] font-black uppercase tracking-widest text-white shadow-lg shadow-blue-500/20 transition-all hover:bg-blue-600 hover:shadow-blue-500/40 hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:pointer-events-none"
        >
          {pending ? 'Guardando...' : 'Guardar cambios'}
        </button>
      </div>

      <DirtyStateGuard 
        show={showExitGuard}
        onConfirm={confirmExit}
        onCancel={cancelExit}
      />
    </form>
  )
}
