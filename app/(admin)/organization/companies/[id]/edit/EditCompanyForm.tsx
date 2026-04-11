'use client'

import { useFormState, useFormStatus } from 'react-dom'
import { ActionState, updateCompany } from '../../../../../actions/companies'
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
    address?: string | null
    phone?: string | null
    report_logo_url?: string | null
  }
}

export default function EditCompanyForm({ company }: EditCompanyFormProps) {
  const updateCompanyWithId = updateCompany.bind(null, company.id)
  const [state, action] = useFormState(updateCompanyWithId, null)
  const [slug, setSlug] = useState(company.slug)
  const [autoSlug, setAutoSlug] = useState(false)

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
      const nameInput = document.getElementById('display_name') as HTMLInputElement
      if (nameInput) {
        setSlug(generateSlugInitials(nameInput.value))
      }
    }
  }

  return (
    <form action={action} className="space-y-8 divide-y divide-slate-700/50">
      <div className="space-y-6">
        {state?.error && (
          <div className="rounded-2xl bg-red-500/10 p-4 text-xs font-bold text-red-400 border border-red-500/20">
            {state.error}
          </div>
        )}

        <div className="grid gap-6 md:grid-cols-2">
          {/* Nombre Comercial */}
          <div className="space-y-2">
            <label htmlFor="display_name" className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              Nombre de la empresa (Comercial) *
            </label>
            <input
              type="text"
              id="display_name"
              name="display_name"
              defaultValue={company.display_name}
              required
              onChange={handleNameChange}
              className="w-full rounded-2xl border border-slate-700 bg-slate-800/50 px-4 py-3 text-sm text-white placeholder:text-slate-500 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
              placeholder="Ej. Gestor360 Nicaragua"
            />
          </div>

          {/* Razón Social */}
          <div className="space-y-2">
            <label htmlFor="legal_name" className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              Razón Social (Legal) *
            </label>
            <input
              type="text"
              id="legal_name"
              name="legal_name"
              defaultValue={company.legal_name}
              required
              className="w-full rounded-2xl border border-slate-700 bg-slate-800/50 px-4 py-3 text-sm text-white placeholder:text-slate-500 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
              placeholder="Ej. Corporación Tecnológica S.A."
            />
          </div>

          {/* Slug */}
          <div className="space-y-2">
            <label htmlFor="slug" className="text-[10px] font-black uppercase tracking-widest text-slate-400">
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
                className="w-full rounded-2xl border border-slate-700 bg-slate-800/50 px-4 py-3 text-sm text-white placeholder:text-slate-500 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                placeholder="Ej. grupo-ct"
              />
              <button
                type="button"
                onClick={toggleAutoSlug}
                className={`absolute right-3 top-1/2 -translate-y-1/2 rounded-lg px-2 py-1 text-[10px] font-black uppercase tracking-widest transition ${autoSlug ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' : 'bg-slate-700 text-slate-400 border border-slate-600'}`}
              >
                Auto {autoSlug ? 'ON' : 'OFF'}
              </button>
            </div>
            <p className="text-[11px] font-medium text-slate-500">Usado para URLs únicas.</p>
          </div>

          {/* RUC */}
          <div className="space-y-2">
            <label htmlFor="tax_id" className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              RUC / NIT (Opcional)
            </label>
            <input
              type="text"
              id="tax_id"
              name="tax_id"
              defaultValue={company.tax_id || ''}
              className="w-full rounded-2xl border border-slate-700 bg-slate-800/50 px-4 py-3 text-sm text-white placeholder:text-slate-500 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
              placeholder="Ej. J0000000000000"
            />
          </div>

          {/* Dirección */}
          <div className="space-y-2 md:col-span-2">
            <label htmlFor="address" className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              Dirección Fiscal (Opcional)
            </label>
            <textarea
              id="address"
              name="address"
              defaultValue={company.address || ''}
              rows={2}
              className="w-full rounded-2xl border border-slate-700 bg-slate-800/50 px-4 py-3 text-sm text-white placeholder:text-slate-500 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
              placeholder="Ej. De la rotonda 1c al sur..."
            />
          </div>

          {/* Teléfono */}
          <div className="space-y-2">
            <label htmlFor="phone" className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              Teléfono de Contacto (Opcional)
            </label>
            <input
              type="text"
              id="phone"
              name="phone"
              defaultValue={company.phone || ''}
              className="w-full rounded-2xl border border-slate-700 bg-slate-800/50 px-4 py-3 text-sm text-white placeholder:text-slate-500 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
              placeholder="Ej. +505 8888-8888"
            />
          </div>

          {/* Logo para reportes */}
          <div className="space-y-2">
            <label htmlFor="logo_file" className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              Logo para Reportes (Opcional)
            </label>
            <div className="flex items-center gap-4">
              {company.report_logo_url && (
                <img src={company.report_logo_url} alt="Logo" className="h-[46px] w-[46px] object-cover rounded-xl border border-slate-700 bg-slate-800/80 p-1" />
              )}
              <div className="flex-1">
                <input
                  type="file"
                  id="logo_file"
                  name="logo_file"
                  accept="image/png, image/jpeg, image/webp"
                  className="w-full rounded-2xl border border-slate-700 bg-slate-800/50 px-4 py-[9px] text-[13px] text-white transition file:mr-4 file:rounded-lg file:border-0 file:bg-blue-500/20 file:px-3 file:py-1 file:text-[11px] file:font-black file:uppercase file:tracking-widest file:text-blue-400 file:border file:border-blue-500/30 hover:file:bg-blue-500/30 cursor-pointer focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                />
                <p className="mt-1 text-[11px] font-medium text-slate-500">Sube una imagen para reemplazar el logo actual.</p>
              </div>
            </div>
            <input type="hidden" name="report_logo_url" value={company.report_logo_url || ''} />
          </div>
        </div>

        {/* Estado */}
        <div className="flex items-center gap-3 pt-4 pb-2 px-2">
          <input
            type="checkbox"
            id="is_active"
            name="is_active"
            defaultChecked={company.is_active}
            className="h-5 w-5 rounded-lg border-slate-700 bg-slate-800 text-blue-500 focus:ring-blue-500"
          />
          <label htmlFor="is_active" className="text-[10px] font-black uppercase tracking-widest text-white">
            Empresa Activa
          </label>
        </div>
      </div>

      <div className="flex items-center justify-end gap-3 pt-6">
        <Link
          href="/organization/companies"
          className="flex h-12 items-center justify-center rounded-2xl px-6 text-[11px] font-black uppercase tracking-widest text-slate-400 border border-transparent transition hover:border-slate-700 hover:text-white"
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
      className="flex h-12 items-center justify-center rounded-2xl bg-blue-500 px-8 text-[11px] font-black uppercase tracking-widest text-white shadow-lg shadow-blue-500/20 transition-all hover:bg-blue-600 hover:shadow-blue-500/40 hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:pointer-events-none"
    >
      {pending ? 'Guardando...' : 'Guardar Cambios'}
    </button>
  )
}
