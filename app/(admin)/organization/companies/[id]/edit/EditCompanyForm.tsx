'use client'

import { useFormState, useFormStatus } from 'react-dom'
import { ActionState, updateCompany } from '@/actions/companies'
import Link from 'next/link'
import { useEffect, useState } from 'react'

interface EditCompanyFormProps {
  company: {
    id: string
    display_name: string
    legal_name: string
    slug: string
    tax_id: string | null
    is_active: boolean
  }
}

export default function EditCompanyForm({ company }: EditCompanyFormProps) {
  const updateCompanyWithId = updateCompany.bind(null, company.id)
  const [state, action] = useFormState(updateCompanyWithId, null)
  const [slug, setSlug] = useState(company.slug)
  const [autoSlug, setAutoSlug] = useState(false)

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (autoSlug) {
      setSlug(e.target.value.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''))
    }
  }

  return (
    <form action={action} className="space-y-8 divide-y divide-slate-100 rounded-3xl bg-white p-8 shadow-sm ring-1 ring-slate-200">
      <div className="space-y-6">
        {state?.error && (
          <div className="rounded-2xl bg-red-50 p-4 text-sm font-medium text-red-800 ring-1 ring-inset ring-red-100">
            {state.error}
          </div>
        )}

        <div className="grid gap-6 md:grid-cols-2">
          {/* Nombre Comercial */}
          <div className="space-y-2">
            <label htmlFor="display_name" className="text-sm font-semibold text-slate-900">
              Nombre de la empresa (Comercial) *
            </label>
            <input
              type="text"
              id="display_name"
              name="display_name"
              defaultValue={company.display_name}
              required
              onChange={handleNameChange}
              className="w-full rounded-2xl bg-slate-50 px-4 py-3 text-sm transition focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900/10"
              placeholder="Ej. Grupo CT Nicaragua"
            />
          </div>

          {/* Razón Social */}
          <div className="space-y-2">
            <label htmlFor="legal_name" className="text-sm font-semibold text-slate-900">
              Razón Social (Legal) *
            </label>
            <input
              type="text"
              id="legal_name"
              name="legal_name"
              defaultValue={company.legal_name}
              required
              className="w-full rounded-2xl bg-slate-50 px-4 py-3 text-sm transition focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900/10"
              placeholder="Ej. Corporación Tecnológica S.A."
            />
          </div>

          {/* Slug */}
          <div className="space-y-2">
            <label htmlFor="slug" className="text-sm font-semibold text-slate-900">
              Slug / Identificador Corto *
            </label>
            <div className="relative">
              <input
                type="text"
                id="slug"
                name="slug"
                value={slug}
                onChange={(e) => {
                  setSlug(e.target.value)
                  setAutoSlug(false)
                }}
                required
                className="w-full rounded-2xl bg-slate-50 px-4 py-3 text-sm transition focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900/10"
                placeholder="Ej. grupo-ct"
              />
              <button
                type="button"
                onClick={() => setAutoSlug(!autoSlug)}
                className={`absolute right-3 top-1/2 -translate-y-1/2 rounded-lg px-2 py-1 text-[10px] font-bold uppercase tracking-wider transition ${autoSlug ? 'bg-slate-900 text-white' : 'bg-slate-200 text-slate-600'}`}
              >
                Auto {autoSlug ? 'ON' : 'OFF'}
              </button>
            </div>
            <p className="text-[11px] text-slate-400">Usado para URLs únicas.</p>
          </div>

          {/* RUC */}
          <div className="space-y-2">
            <label htmlFor="tax_id" className="text-sm font-semibold text-slate-900">
              RUC / NIT (Opcional)
            </label>
            <input
              type="text"
              id="tax_id"
              name="tax_id"
              defaultValue={company.tax_id || ''}
              className="w-full rounded-2xl bg-slate-50 px-4 py-3 text-sm transition focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900/10"
              placeholder="Ej. J0000000000000"
            />
          </div>
        </div>

        {/* Estado */}
        <div className="flex items-center gap-3 space-y-2">
          <input
            type="checkbox"
            id="is_active"
            name="is_active"
            defaultChecked={company.is_active}
            className="h-5 w-5 rounded-lg border-slate-200 text-slate-900 focus:ring-slate-900"
          />
          <label htmlFor="is_active" className="text-sm font-semibold text-slate-900">
            Empresa Activa
          </label>
        </div>
      </div>

      <div className="flex items-center justify-end gap-4 pt-8">
        <Link
          href="/organization/companies"
          className="rounded-2xl px-6 py-3 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
        >
          Cancelar
        </Link>
        <SubmitButton />
      </div>
    </form>
  )
}

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-2xl bg-slate-900 px-8 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-50"
    >
      {pending ? 'Guardando...' : 'Guardar Cambios'}
    </button>
  )
}
