'use client'

import { useState, useActionState, useRef } from 'react'
import Link from 'next/link'
import { updateEmployee, type ActionState } from '../../../../actions/employees'
import { uploadEmployeePhoto, type UploadPhotoState } from '../../../../actions/upload-photo'
import { PinManager } from '../pin-manager'

interface EmployeeEditFormProps {
  employee: {
    id: string
    employee_code?: string | null
    first_name: string
    last_name: string
    email: string | null
    phone: string | null
    hire_date: string | null
    branch_id: string
    is_active: boolean
    national_id: string | null
    social_security_id: string | null
    tax_id: string | null
    birth_date: string | null
    gender: string | null
    address: string | null
    photo_url: string | null
  }
  branches: { id: string; name: string }[]
}

type Tab = 'general' | 'identificacion' | 'ubicacion' | 'foto' | 'seguridad'

export function EmployeeEditForm({ employee, branches }: EmployeeEditFormProps) {
  const [activeTab, setActiveTab] = useState<Tab>('general')
  const [previewUrl, setPreviewUrl] = useState<string | null>(employee.photo_url)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [nationalId, setNationalId] = useState(employee.national_id ?? '')
  const [taxId, setTaxId] = useState(employee.tax_id ?? '')
  const [inss, setInss] = useState(employee.social_security_id ?? '')

  const updateEmployeeWithId = updateEmployee.bind(null, employee.id)
  const [state, action, pending] = useActionState<ActionState, FormData>(updateEmployeeWithId, null)

  const uploadPhotoWithId = uploadEmployeePhoto.bind(null, employee.id)
  const [photoState, photoAction, photoPending] = useActionState<UploadPhotoState, FormData>(uploadPhotoWithId, null)

  const tabClass = (tab: Tab) =>
    `px-5 py-3 text-sm font-semibold transition-all border-b-2 whitespace-nowrap ${
      activeTab === tab
        ? 'border-slate-900 text-slate-900'
        : 'border-transparent text-slate-500 hover:text-slate-700'
    }`

  const initials = `${employee.first_name[0] ?? ''}${employee.last_name[0] ?? ''}`.toUpperCase()

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const url = URL.createObjectURL(file)
      setPreviewUrl(url)
    }
  }

  // Máscara Cédula Nicaragua: 000-000000-0000A
  const handleNationalIdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.replace(/[^0-9A-Za-z]/g, '').toUpperCase()
    if (val.length > 3) val = val.slice(0, 3) + '-' + val.slice(3)
    if (val.length > 10) val = val.slice(0, 10) + '-' + val.slice(10, 15)
    setNationalId(val.slice(0, 16))
  }

  // Máscara RUC Nicaragua: 14 caracteres alfanuméricos
  const handleTaxIdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.replace(/[^0-9A-Za-z]/g, '').toUpperCase()
    setTaxId(val.slice(0, 14))
  }

  // Máscara INSS: 8 o 9 dígitos
  const handleInssChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.replace(/[^0-9]/g, '')
    if (val.length > 8) val = val.slice(0, 8) + '-' + val.slice(8, 9)
    setInss(val.slice(0, 10))
  }

  return (
    <div className="space-y-8">
      {/* Navegación de Pestañas */}
      <div className="flex overflow-x-auto border-b border-slate-100 -mx-6 px-6 hide-scrollbar">
        <button type="button" onClick={() => setActiveTab('general')} className={tabClass('general')}>
          General
        </button>
        <button type="button" onClick={() => setActiveTab('identificacion')} className={tabClass('identificacion')}>
          Legal (ID)
        </button>
        <button type="button" onClick={() => setActiveTab('seguridad')} className={tabClass('seguridad')}>
          Seguridad y Kiosko
        </button>
        <button type="button" onClick={() => setActiveTab('ubicacion')} className={tabClass('ubicacion')}>
          Ubicación
        </button>
        <button type="button" onClick={() => setActiveTab('foto')} className={tabClass('foto')}>
          Foto
        </button>
      </div>

      {/* ===================== PESTAÑA: FOTO ===================== */}
      {activeTab === 'foto' && (
        <form action={photoAction} className="space-y-6 animate-in fade-in duration-300">
          <div className="flex flex-col items-center gap-6">

            <div className="relative">
              {previewUrl ? (
                <img
                  src={previewUrl}
                  alt="Foto de perfil"
                  className="h-36 w-36 rounded-full object-cover ring-4 ring-slate-100 shadow-lg"
                />
              ) : (
                <div className="flex h-36 w-36 items-center justify-center rounded-full bg-slate-200 ring-4 ring-slate-100 shadow-lg">
                  <span className="text-4xl font-bold text-slate-500">{initials}</span>
                </div>
              )}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="absolute bottom-1 right-1 flex h-9 w-9 items-center justify-center rounded-full bg-slate-900 text-white shadow-md transition hover:bg-slate-700"
                title="Cambiar foto"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
              </button>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              name="photo"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={handleFileChange}
            />

            <div className="text-center">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="text-sm font-semibold text-slate-700 underline underline-offset-2 hover:text-slate-900"
              >
                Seleccionar imagen
              </button>
              <p className="mt-1 text-xs text-slate-400">JPG, PNG o WebP · Máximo 3 MB</p>
            </div>

            {photoState && 'error' in photoState && (
              <div className="w-full rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-600 ring-1 ring-red-200 text-center">
                {photoState.error}
              </div>
            )}
            {photoState && 'success' in photoState && (
              <div className="w-full rounded-2xl bg-green-50 px-4 py-3 text-sm text-green-700 ring-1 ring-green-200 text-center">
                ✓ Foto actualizada correctamente
              </div>
            )}

            <button
              type="submit"
              disabled={photoPending}
              className="flex h-12 w-full flex-1 items-center justify-center rounded-2xl bg-slate-900 px-8 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-50"
            >
              {photoPending ? 'Subiendo...' : 'Guardar foto'}
            </button>
          </div>
        </form>
      )}

      {/* ===================== PESTAÑA: SEGURIDAD ===================== */}
      {activeTab === 'seguridad' && (
        <div className="animate-in fade-in duration-300">
           <PinManager employeeId={employee.id} currentPin={employee.employee_code ?? '0000'} />
           <div className="mt-8 rounded-2xl bg-slate-50 p-6 ring-1 ring-slate-200">
              <h3 className="text-sm font-semibold text-slate-900">Configuración de Kiosko</h3>
              <p className="mt-2 text-sm text-slate-500">
                Las opciones avanzadas de acceso y permisos de marcación por kiosko se configuran aquí. 
                Asegúrate de que el colaborador tenga un turno asignado antes de requerir su PIN.
              </p>
           </div>
        </div>
      )}

      {/* ===================== RESTO DE PESTAÑAS (FORMULARIO PRINCIPAL) ===================== */}
      {(activeTab === 'general' || activeTab === 'identificacion' || activeTab === 'ubicacion') && (
        <form action={action} className="space-y-8 animate-in fade-in duration-300">
          {state?.error && (
            <div className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-600 ring-1 ring-red-200">
              {state.error}
            </div>
          )}

          <div className="min-h-[400px]">
            {/* PESTAÑA: GENERAL */}
            <div className={activeTab === 'general' ? 'block' : 'hidden'}>
              <div className="grid gap-6 sm:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-900">Nombres *</label>
                  <input type="text" name="first_name" defaultValue={employee.first_name} required className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200" />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-900">Apellidos *</label>
                  <input type="text" name="last_name" defaultValue={employee.last_name} required className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200" />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-900">Correo electrónico</label>
                  <input type="email" name="email" defaultValue={employee.email ?? ''} className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200" />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-900">Teléfono</label>
                  <input type="tel" name="phone" defaultValue={employee.phone ?? ''} className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200" />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-900">Sucursal *</label>
                  <select name="branch_id" defaultValue={employee.branch_id} required className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200">
                    {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </div>
                <div className="flex items-center gap-3 pt-8">
                  <input type="checkbox" id="is_active" name="is_active" defaultChecked={employee.is_active} className="h-5 w-5 rounded-lg text-slate-900" />
                  <label htmlFor="is_active" className="text-sm font-semibold text-slate-900">Colaborador Activo</label>
                </div>
              </div>
            </div>

            {/* PESTAÑA: IDENTIFICACIÓN */}
            <div className={activeTab === 'identificacion' ? 'block' : 'hidden'}>
              <div className="grid gap-6 sm:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-900">N° Cédula de Identidad</label>
                  <input type="text" name="national_id" value={nationalId} onChange={handleNationalIdChange} placeholder="000-000000-0000A" className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm uppercase outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200 tracking-wider" />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-900">N° INSS</label>
                  <input type="text" name="social_security_id" value={inss} onChange={handleInssChange} placeholder="1234567-8" className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm tracking-wider uppercase outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200" />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-900">N° RUC</label>
                  <input type="text" name="tax_id" value={taxId} onChange={handleTaxIdChange} placeholder="J0000000000000" className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm uppercase tracking-wider outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200" />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-900">Fecha de Nacimiento</label>
                  <input type="date" name="birth_date" defaultValue={employee.birth_date ?? ''} className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200" />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-900">Género</label>
                  <select name="gender" defaultValue={employee.gender ?? ''} className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200">
                    <option value="">No especificado</option>
                    <option value="M">Masculino</option>
                    <option value="F">Femenino</option>
                  </select>
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-900">Fecha de Ingreso</label>
                  <input type="date" name="hire_date" defaultValue={employee.hire_date ? new Date(employee.hire_date).toISOString().split('T')[0] : ''} className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200" />
                </div>
              </div>
            </div>

            {/* PESTAÑA: UBICACIÓN */}
            <div className={activeTab === 'ubicacion' ? 'block' : 'hidden'}>
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-900">Dirección Domiciliar Completa</label>
                <textarea name="address" defaultValue={employee.address ?? ''} rows={4} className="w-full rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200" placeholder="Ej. De los semáforos 2c al lago..." />
              </div>
            </div>
          </div>

          <div className="pt-8 flex justify-end gap-3 border-t border-slate-100">
             <Link href={`/employees/${employee.id}`} className="flex h-12 items-center justify-center rounded-2xl px-6 text-sm font-semibold text-slate-600 transition hover:bg-slate-50">
              Cancelar
            </Link>
            <button type="submit" disabled={pending} className="flex h-12 items-center justify-center rounded-2xl bg-slate-900 px-8 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-50">
              {pending ? 'Guardando...' : 'Guardar cambios'}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}

