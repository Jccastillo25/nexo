'use client'

import { useActionState, useState } from 'react'
import Link from 'next/link'
import { createCompany, type ActionState } from '../../../../actions/companies'

export function CompanyForm() {
  const [state, action, pending] = useActionState<ActionState, FormData>(createCompany, null)
  const [slug, setSlug] = useState('')
  const [autoSlug, setAutoSlug] = useState(true)

  function generateSlugInitials(name: string) {
    if (!name) return ''
    return name
      .trim()
      .split(/\s+/)
      .map(word => word[0])
      .join('')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '')
  }

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (autoSlug) {
      setSlug(generateSlugInitials(e.target.value))
    }
  }

  const toggleAutoSlug = () => {
    const newAuto = !autoSlug
    setAutoSlug(newAuto)
    if (newAuto) {
      const nameInput = document.getElementsByName('display_name')[0] as HTMLInputElement
      if (nameInput) {
        setSlug(generateSlugInitials(nameInput.value))
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
            Nombre de la empresa (Comercial) *
          </label>
          <input
            type="text"
            name="display_name"
            required
            onChange={handleNameChange}
            placeholder="Ej. Grupo CT Nicaragua"
            className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
          />
        </div>

        <div className="sm:col-span-2">
          <label className="mb-2 block text-sm font-semibold text-slate-900">
            Razón Social (Legal) *
          </label>
          <input
            type="text"
            name="legal_name"
            required
            placeholder="Ej. Corporación Tecnológica S.A."
            className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
          />
        </div>

        <div className="sm:col-span-2">
          <label className="mb-2 block text-sm font-semibold text-slate-900">
            Slug / Identificador Corto *
          </label>
          <div className="relative">
            <input
              type="text"
              name="slug"
              value={slug}
              onChange={(e) => {
                setSlug(e.target.value)
                setAutoSlug(false)
              }}
              required
              placeholder="Ej. GCT"
              className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
            />
            <button
              type="button"
              onClick={toggleAutoSlug}
              className={`absolute right-3 top-1/2 -translate-y-1/2 rounded-lg px-2 py-1 text-[10px] font-bold uppercase tracking-wider transition ${autoSlug ? 'bg-slate-900 text-white' : 'bg-slate-200 text-slate-600'}`}
            >
              Auto {autoSlug ? 'ON' : 'OFF'}
            </button>
          </div>
          <p className="mt-2 text-xs text-slate-500">Usado para URLs únicas. Se genera automáticamente basado en las iniciales.</p>
        </div>

        <div className="sm:col-span-2">
           <label className="mb-2 block text-sm font-semibold text-slate-900">
            RUC / NIT (Opcional)
          </label>
          <input
            type="text"
            name="tax_id"
            placeholder="Ej. J0000000000000"
            className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
          />
        </div>
      </div>

      <div className="pt-4 flex justify-end gap-3 border-t border-slate-100">
        <Link
          href="/organization/companies"
          className="flex h-12 items-center justify-center rounded-2xl px-6 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
        >
          Cancelar
        </Link>
        <button
          type="submit"
          disabled={pending}
          className="flex h-12 items-center justify-center rounded-2xl bg-slate-900 px-8 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-50"
        >
          {pending ? 'Creando Empresa...' : 'Crear Empresa'}
        </button>
      </div>
    </form>
  )
}
