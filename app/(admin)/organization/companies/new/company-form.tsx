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
        <div className="rounded-2xl bg-red-500/10 px-4 py-3 text-xs font-bold text-red-400 border border-red-500/20">
          {state.error}
        </div>
      )}

      <div className="grid gap-6 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="mb-2 block text-[10px] font-black uppercase tracking-widest text-slate-400">
            Nombre de la empresa (Comercial) *
          </label>
          <input
            type="text"
            name="display_name"
            required
            onChange={handleNameChange}
            placeholder="Ej. Gestor360 Nicaragua"
            className="h-12 w-full rounded-2xl border border-slate-700 bg-slate-800/50 px-4 text-sm text-white outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 placeholder:text-slate-500"
          />
        </div>

        <div className="sm:col-span-2">
          <label className="mb-2 block text-[10px] font-black uppercase tracking-widest text-slate-400">
            Razón Social (Legal) *
          </label>
          <input
            type="text"
            name="legal_name"
            required
            placeholder="Ej. Corporación Tecnológica S.A."
            className="h-12 w-full rounded-2xl border border-slate-700 bg-slate-800/50 px-4 text-sm text-white outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 placeholder:text-slate-500"
          />
        </div>

        <div className="sm:col-span-2">
          <label className="mb-2 block text-[10px] font-black uppercase tracking-widest text-slate-400">
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
              className="h-12 w-full rounded-2xl border border-slate-700 bg-slate-800/50 px-4 text-sm text-white outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 placeholder:text-slate-500"
            />
            <button
              type="button"
              onClick={toggleAutoSlug}
              className={`absolute right-3 top-1/2 -translate-y-1/2 rounded-lg px-2 py-1 text-[10px] font-black uppercase tracking-widest transition ${autoSlug ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' : 'bg-slate-700 text-slate-400 border border-slate-600'}`}
            >
              Auto {autoSlug ? 'ON' : 'OFF'}
            </button>
          </div>
          <p className="mt-2 text-[11px] font-medium text-slate-500">Usado para URLs únicas. Se genera automáticamente basado en las iniciales.</p>
        </div>

        <div className="sm:col-span-2">
           <label className="mb-2 block text-[10px] font-black uppercase tracking-widest text-slate-400">
            RUC / NIT (Opcional)
          </label>
          <input
            type="text"
            name="tax_id"
            placeholder="Ej. J0000000000000"
            className="h-12 w-full rounded-2xl border border-slate-700 bg-slate-800/50 px-4 text-sm text-white outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 placeholder:text-slate-500"
          />
        </div>

        <div className="sm:col-span-2">
          <label className="mb-2 block text-[10px] font-black uppercase tracking-widest text-slate-400">
            Dirección Fiscal (Opcional)
          </label>
          <textarea
            name="address"
            rows={2}
            placeholder="Ej. De la rotonda 1c al sur..."
            className="w-full rounded-2xl border border-slate-700 bg-slate-800/50 px-4 py-3 text-sm text-white outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 placeholder:text-slate-500"
          />
        </div>

        <div className="sm:col-span-1">
          <label className="mb-2 block text-[10px] font-black uppercase tracking-widest text-slate-400">
            Teléfono de Contacto (Opcional)
          </label>
          <input
            type="text"
            name="phone"
            placeholder="Ej. +505 8888-8888"
            className="h-12 w-full rounded-2xl border border-slate-700 bg-slate-800/50 px-4 text-sm text-white outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 placeholder:text-slate-500"
          />
        </div>

        <div className="sm:col-span-1">
          <label className="mb-2 block text-[10px] font-black uppercase tracking-widest text-slate-400">
            Logo para Reportes (Opcional)
          </label>
          <input
            type="file"
            name="logo_file"
            accept="image/png, image/jpeg, image/webp"
            className="h-12 w-full rounded-2xl border border-slate-700 bg-slate-800/50 px-4 py-[9px] text-sm text-white outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 file:mr-4 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-[11px] file:font-black file:uppercase file:tracking-widest file:bg-blue-500/20 file:text-blue-400 file:border file:border-blue-500/30 hover:file:bg-blue-500/30 cursor-pointer"
          />
          <p className="mt-1 text-[11px] font-medium text-slate-500">Max 3MB. PNG, JPG o WebP.</p>
        </div>
      </div>

      <div className="pt-4 flex justify-end gap-3 border-t border-slate-700/50">
        <Link
          href="/organization/companies"
          className="flex h-12 items-center justify-center rounded-2xl px-6 text-[11px] font-black uppercase tracking-widest text-slate-400 border border-transparent transition hover:border-slate-700 hover:text-white"
        >
          Cancelar
        </Link>
        <button
          type="submit"
          disabled={pending}
          className="flex h-12 items-center justify-center rounded-2xl bg-blue-500 px-8 text-[11px] font-black uppercase tracking-widest text-white shadow-lg shadow-blue-500/20 transition-all hover:bg-blue-600 hover:shadow-blue-500/40 hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:pointer-events-none"
        >
          {pending ? 'Creando Empresa...' : 'Crear Empresa'}
        </button>
      </div>
    </form>
  )
}
