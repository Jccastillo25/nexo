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
  const { isDirty, checkDirty, resetInitial } = useDirtyState({
    initialState: {
      company_id: branch.company_id,
      name: branch.name,
      code: branch.code || '',
      address: branch.address || '',
      is_active: branch.is_active,
    }
  })
  const [showExitGuard, setShowExitGuard] = useState(false)

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
        <div className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-600 ring-1 ring-red-200">
          {state.error}
        </div>
      )}

      <div className="grid gap-6 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="mb-2 block text-sm font-semibold text-slate-900">
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
            className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
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
          <label className="mb-2 block text-sm font-semibold text-slate-900">
            Nombre de la sucursal *
          </label>
          <input
            type="text"
            name="name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ej. Oficina Central"
            className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
          />
        </div>

        <div className="sm:col-span-2">
          <label className="mb-2 block text-sm font-semibold text-slate-900">
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
              className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
            />
            <button
              type="button"
              onClick={toggleAutoCode}
              className={`absolute right-3 top-1/2 -translate-y-1/2 rounded-lg px-2 py-1 text-[10px] font-bold uppercase tracking-wider transition ${autoCode ? 'bg-slate-900 text-white' : 'bg-slate-200 text-slate-600'}`}
            >
              Auto {autoCode ? 'ON' : 'OFF'}
            </button>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Identificador corto para reportes.
          </p>
        </div>

        <div className="sm:col-span-2">
          <label className="mb-2 block text-sm font-semibold text-slate-900">
            Dirección (Opcional)
          </label>
          <textarea
            name="address"
            defaultValue={branch.address}
            placeholder="Dirección completa de la sucursal"
            rows={3}
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
          />
        </div>

        <div className="sm:col-span-2 flex items-center gap-3">
          <input
            type="checkbox"
            id="is_active"
            name="is_active"
            defaultChecked={branch.is_active}
            className="h-5 w-5 rounded-lg border-slate-200 text-slate-900 focus:ring-slate-900"
          />
          <label htmlFor="is_active" className="text-sm font-semibold text-slate-900 cursor-pointer">
            Sucursal Activa
          </label>
        </div>
      </div>

      <div className="pt-4 flex justify-end gap-3 border-t border-slate-100">
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
              setShowExitGuard(true)
            }
          }}
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

      <DirtyStateGuard 
        show={showExitGuard}
        onConfirm={() => {
          setShowExitGuard(false)
          window.location.href = '/organization/branches'
        }}
        onCancel={() => setShowExitGuard(false)}
      />
    </form>
  )
}
