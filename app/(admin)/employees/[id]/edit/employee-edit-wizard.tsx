'use client'

import { useState, useActionState, useRef } from 'react'
import Link from 'next/link'
import { updateEmployee, type ActionState } from '../../../../actions/employees'
import { uploadEmployeePhoto, type UploadPhotoState } from '../../../../actions/upload-photo'
import { PinManager } from '../pin-manager'

interface EmployeeEditWizardProps {
  employee: {
    id: string
    employee_code?: string | null
    employee_number: string | null
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
  hasActiveContract: boolean
  activeContract?: {
    id: string
    social_security_number: string | null
    hire_date: string | null
  }
}

type Step = 1 | 2 | 3 | 4 | 5

export function EmployeeEditWizard({ employee, branches, hasActiveContract, activeContract }: EmployeeEditWizardProps) {
  const [step, setStep] = useState<Step>(1)
  const [previewUrl, setPreviewUrl] = useState<string | null>(employee.photo_url)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [nationalId, setNationalId] = useState(employee.national_id ?? '')
  const [taxId, setTaxId] = useState(employee.tax_id ?? '')

  const updateEmployeeWithId = updateEmployee.bind(null, employee.id)
  const [state, action, pending] = useActionState<ActionState, FormData>(updateEmployeeWithId, null)

  const uploadPhotoWithId = uploadEmployeePhoto.bind(null, employee.id)
  const [photoState, photoAction, photoPending] = useActionState<UploadPhotoState, FormData>(uploadPhotoWithId, null)

  const initials = `${employee.first_name[0] ?? ''}${employee.last_name[0] ?? ''}`.toUpperCase()

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const url = URL.createObjectURL(file)
      setPreviewUrl(url)
    }
  }

  const handleNationalIdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.replace(/[^0-9A-Za-z]/g, '').toUpperCase()
    if (val.length > 3) val = val.slice(0, 3) + '-' + val.slice(3)
    if (val.length > 10) val = val.slice(0, 10) + '-' + val.slice(10, 15)
    setNationalId(val.slice(0, 16))
  }

  const handleTaxIdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.replace(/[^0-9A-Za-z]/g, '').toUpperCase()
    setTaxId(val.slice(0, 14))
  }


  const nextStep = () => setStep((s) => (s === 5 ? 5 : (s + 1) as Step))
  const prevStep = () => setStep((s) => (s === 1 ? 1 : (s - 1) as Step))

  return (
    <div className="space-y-8">
      {/* Progress Bar */}
      <div className="flex items-center justify-between px-2">
        {[1, 2, 3, 4, 5].map((s) => (
          <div key={s} className="flex flex-1 items-center last:flex-none">
            <div
              className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold transition ${
                step >= s ? 'bg-slate-900 text-white shadow-lg' : 'bg-slate-100 text-slate-400'
              }`}
            >
              {s}
            </div>
            {s < 5 && (
              <div
                className={`h-1 flex-1 mx-2 rounded-full transition ${step > s ? 'bg-slate-900' : 'bg-slate-100'}`}
              />
            )}
          </div>
        ))}
      </div>

      {/* Step 1: Información Personal */}
      {step === 1 && (
        <div className="space-y-6 animate-in fade-in duration-300">
          <div>
            <h2 className="text-lg font-bold text-slate-900 mb-4">Información Personal</h2>
            <div className="grid gap-6 sm:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-900">Nombres *</label>
                <input
                  type="text"
                  name="first_name"
                  defaultValue={employee.first_name}
                  required
                  className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-900">Apellidos *</label>
                <input
                  type="text"
                  name="last_name"
                  defaultValue={employee.last_name}
                  required
                  className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-900">Correo Electrónico</label>
                <input
                  type="email"
                  name="email"
                  defaultValue={employee.email ?? ''}
                  className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-900">Teléfono</label>
                <input
                  type="tel"
                  name="phone"
                  defaultValue={employee.phone ?? ''}
                  className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-900">Sucursal *</label>
                <select
                  name="branch_id"
                  defaultValue={employee.branch_id}
                  required
                  className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
                >
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-3 pt-4">
                <input
                  type="checkbox"
                  id="is_active"
                  name="is_active"
                  defaultChecked={employee.is_active}
                  className="h-5 w-5 rounded-lg text-slate-900"
                />
                <label htmlFor="is_active" className="text-sm font-semibold text-slate-900">
                  Colaborador Activo
                </label>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Step 2: Datos Legales */}
      {step === 2 && (
        <div className="space-y-6 animate-in fade-in duration-300">
          <div>
            <h2 className="text-lg font-bold text-slate-900 mb-4">Datos Legales</h2>
            <div className="grid gap-6 sm:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-900">Cédula de Identidad</label>
                <input
                  type="text"
                  name="national_id"
                  value={nationalId}
                  onChange={handleNationalIdChange}
                  placeholder="000-000000-0000A"
                  className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 placeholder:text-slate-400 uppercase outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200 tracking-wider"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-900">N° RUC</label>
                <input
                  type="text"
                  name="tax_id"
                  value={taxId}
                  onChange={handleTaxIdChange}
                  placeholder="J0000000000000"
                  className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 placeholder:text-slate-400 uppercase tracking-wider outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-900">Fecha de Nacimiento</label>
                <input
                  type="date"
                  name="birth_date"
                  defaultValue={employee.birth_date ?? ''}
                  className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-900">Género</label>
                <select
                  name="gender"
                  defaultValue={employee.gender ?? ''}
                  className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
                >
                  <option value="">No especificado</option>
                  <option value="M">Masculino</option>
                  <option value="F">Femenino</option>
                </select>
              </div>
            </div>
            {hasActiveContract && activeContract && (
              <div className="mt-6 space-y-4 pt-4 border-t border-slate-100">
                <h3 className="font-semibold text-slate-900">Información del Contrato Activo</h3>
                <div className="grid gap-6 sm:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-slate-500 uppercase tracking-tight">Número INSS (Solo Lectura)</label>
                    <div className="h-12 w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 flex items-center text-sm font-semibold text-slate-700">
                      {activeContract.social_security_number || '—'}
                    </div>
                    <p className="mt-1 text-xs text-slate-500">Proviene del contrato activo</p>
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-slate-500 uppercase tracking-tight">Fecha de Ingreso (Solo Lectura)</label>
                    <div className="h-12 w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 flex items-center text-sm font-semibold text-slate-700">
                      {activeContract.hire_date ? new Date(activeContract.hire_date).toLocaleDateString('es-NI') : '—'}
                    </div>
                    <p className="mt-1 text-xs text-slate-500">Proviene del contrato activo</p>
                  </div>
                </div>
              </div>
            )}

            {!hasActiveContract && (
              <div className="mt-6 p-4 rounded-2xl bg-amber-50 border border-amber-200">
                <p className="text-sm text-amber-700">
                  <strong>Sin contrato activo:</strong> Los datos de INSS y Fecha de Ingreso se mostrarán aquí cuando se vincule un contrato activo.
                </p>
              </div>
            )}

            {hasActiveContract && !activeContract && (
              <div className="mt-6 p-4 rounded-2xl bg-blue-50 border border-blue-100">
                <p className="text-sm text-blue-700">
                  <strong>Nota:</strong> Este colaborador tiene un contrato activo. Los datos de INSS y Fecha de Ingreso se configuran en el <strong>Contrato</strong>, no en el perfil.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Step 3: Ubicación */}
      {step === 3 && (
        <div className="space-y-6 animate-in fade-in duration-300">
          <div>
            <h2 className="text-lg font-bold text-slate-900 mb-4">Ubicación</h2>
            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-900">Dirección Domiciliar Completa</label>
              <textarea
                name="address"
                defaultValue={employee.address ?? ''}
                rows={4}
                className="w-full rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
                placeholder="Ej. De los semáforos 2c al lago..."
              />
            </div>
          </div>
        </div>
      )}

      {/* Step 4: Acceso y Kiosko */}
      {step === 4 && (
        <div className="animate-in fade-in duration-300">
          <h2 className="text-lg font-bold text-slate-900 mb-4">Acceso y Kiosko</h2>
          <PinManager
            employeeId={employee.id}
            currentPin={employee.employee_code ?? '0000'}
            hasActiveContract={hasActiveContract}
            employeeNumber={employee.employee_number}
          />
          <div className="mt-8 rounded-2xl bg-slate-50 p-6 ring-1 ring-slate-200">
            <h3 className="text-sm font-semibold text-slate-900">Configuración de Kiosko</h3>
            <p className="mt-2 text-sm text-slate-500">
              Las opciones avanzadas de acceso y permisos de marcación por kiosko se configuran aquí. Asegúrate de que
              el colaborador tenga un turno asignado antes de requerir su PIN.
            </p>
          </div>
        </div>
      )}

      {/* Step 5: Foto */}
      {step === 5 && (
        <form action={photoAction} className="space-y-6 animate-in fade-in duration-300">
          <div className="flex flex-col items-center gap-6">
            <h2 className="text-lg font-bold text-slate-900">Foto de Perfil</h2>

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
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
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
              <div className="w-full rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-600 ring-1 ring-red-200 text-center">{photoState.error}</div>
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

      {/* Error Display */}
      {state?.error && step !== 5 && (
        <div className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-600 ring-1 ring-red-200">{state.error}</div>
      )}

      {/* Form: Only for Step 3 (saving) */}
      {step === 3 && (
        <form action={action} className="space-y-6">
          {state?.error && (
            <div className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-600 ring-1 ring-red-200">{state.error}</div>
          )}

          {/* Hidden fields from other steps */}
          <input type="hidden" name="first_name" defaultValue={employee.first_name} />
          <input type="hidden" name="last_name" defaultValue={employee.last_name} />
          <input type="hidden" name="email" defaultValue={employee.email ?? ''} />
          <input type="hidden" name="phone" defaultValue={employee.phone ?? ''} />
          <input type="hidden" name="branch_id" defaultValue={employee.branch_id} />
          <input type="hidden" name="is_active" defaultValue={employee.is_active ? 'on' : ''} />
          <input type="hidden" name="national_id" value={nationalId} />
          <input type="hidden" name="tax_id" value={taxId} />
          <input type="hidden" name="birth_date" defaultValue={employee.birth_date ?? ''} />
          <input type="hidden" name="gender" defaultValue={employee.gender ?? ''} />
          <input type="hidden" name="address" defaultValue={employee.address ?? ''} />

          {/* Navigation for Step 3 */}
          <div className="flex items-center justify-between pt-6 border-t border-slate-100">
            <button
              type="button"
              onClick={prevStep}
              className="flex h-12 items-center justify-center rounded-2xl px-6 text-sm font-bold text-slate-700 transition hover:bg-slate-100"
            >
              ← Atrás
            </button>

            <button
              type="submit"
              disabled={pending}
              className="flex h-12 items-center justify-center rounded-2xl bg-slate-900 px-8 text-sm font-bold text-white shadow-xl transition hover:bg-slate-800 disabled:opacity-50 active:scale-95"
            >
              {pending ? 'Guardando...' : 'Guardar y Continuar'}
            </button>
          </div>
        </form>
      )}

      {/* Navigation for Steps 1 & 2 (non-form navigation) */}
      {(step === 1 || step === 2) && (
        <div className="flex items-center justify-between pt-6 border-t border-slate-100">
          {step > 1 ? (
            <button
              type="button"
              onClick={prevStep}
              className="flex h-12 items-center justify-center rounded-2xl px-6 text-sm font-bold text-slate-700 transition hover:bg-slate-100"
            >
              ← Atrás
            </button>
          ) : (
            <Link
              href={`/employees/${employee.id}`}
              className="flex h-12 items-center justify-center rounded-2xl px-6 text-sm font-bold text-slate-700 transition hover:bg-slate-100"
            >
              Cancelar
            </Link>
          )}

          <button
            type="button"
            onClick={nextStep}
            className="flex h-12 items-center justify-center rounded-2xl bg-slate-900 px-8 text-sm font-bold text-white shadow-xl transition hover:bg-slate-800 active:scale-95"
          >
            Siguiente →
          </button>
        </div>
      )}

      {/* Navigation for Step 4 & 5 */}
      {(step === 4 || step === 5) && (
        <div className="flex items-center justify-between pt-6 border-t border-slate-100">
          <button
            type="button"
            onClick={prevStep}
            className="flex h-12 items-center justify-center rounded-2xl px-6 text-sm font-bold text-slate-700 transition hover:bg-slate-100"
          >
            ← Atrás
          </button>

          {step < 5 ? (
            <button
              type="button"
              onClick={nextStep}
              className="flex h-12 items-center justify-center rounded-2xl bg-slate-900 px-8 text-sm font-bold text-white shadow-xl transition hover:bg-slate-800 active:scale-95"
            >
              Siguiente →
            </button>
          ) : (
            <Link
              href={`/employees/${employee.id}`}
              className="flex h-12 items-center justify-center rounded-2xl bg-slate-900 px-8 text-sm font-bold text-white shadow-xl transition hover:bg-slate-800 active:scale-95"
            >
              Finalizar
            </Link>
          )}
        </div>
      )}
    </div>
  )
}
