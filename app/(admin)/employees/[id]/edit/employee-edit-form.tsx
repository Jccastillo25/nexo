'use client'

import { useState } from 'react'
import { useActionState } from 'react'
import Link from 'next/link'
import { updateEmployee, type ActionState } from '../../../../actions/employees'

interface EmployeeEditFormProps {
  employee: {
    id: string
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
  }
  branches: { id: string; name: string }[]
}

type Tab = 'general' | 'identificacion' | 'ubicacion'

export function EmployeeEditForm({ employee, branches }: EmployeeEditFormProps) {
  const [activeTab, setActiveTab] = useState<Tab>('general')
  const updateEmployeeWithId = updateEmployee.bind(null, employee.id)
  const [state, action, pending] = useActionState<ActionState, FormData>(updateEmployeeWithId, null)

  const tabClass = (tab: Tab) => 
    `px-6 py-3 text-sm font-semibold transition-all border-b-2 ${
      activeTab === tab 
        ? 'border-slate-900 text-slate-900' 
        : 'border-transparent text-slate-500 hover:text-slate-700'
    }`

  return (
    <form action={action} className="space-y-8">
      {state?.error && (
        <div className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-600 ring-1 ring-red-200">
          {state.error}
        </div>
      )}

      {/* Navegación de Pestañas */}
      <div className="flex border-b border-slate-100">
        <button type="button" onClick={() => setActiveTab('general')} className={tabClass('general')}>
          General
        </button>
        <button type="button" onClick={() => setActiveTab('identificacion')} className={tabClass('identificacion')}>
          Identificación Legal
        </button>
        <button type="button" onClick={() => setActiveTab('ubicacion')} className={tabClass('ubicacion')}>
          Ubicación
        </button>
      </div>

      <div className="min-h-[400px]">
        {/* PESTAÑA: GENERAL */}
        {activeTab === 'general' && (
          <div className="grid gap-6 sm:grid-cols-2 animate-in fade-in duration-300">
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
        )}

        {/* PESTAÑA: IDENTIFICACIÓN */}
        {activeTab === 'identificacion' && (
          <div className="grid gap-6 sm:grid-cols-2 animate-in fade-in duration-300">
            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-900">N° Cédula de Identidad</label>
              <input type="text" name="national_id" defaultValue={employee.national_id ?? ''} placeholder="000-000000-0000X" className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200" />
            </div>
            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-900">N° INSS (Seguridad Social)</label>
              <input type="text" name="social_security_id" defaultValue={employee.social_security_id ?? ''} className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200" />
            </div>
            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-900">N° RUC</label>
              <input type="text" name="tax_id" defaultValue={employee.tax_id ?? ''} className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200" />
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
        )}

        {/* PESTAÑA: UBICACIÓN */}
        {activeTab === 'ubicacion' && (
          <div className="animate-in fade-in duration-300">
            <label className="mb-2 block text-sm font-semibold text-slate-900">Dirección Domiciliar Completa</label>
            <textarea name="address" defaultValue={employee.address ?? ''} rows={4} className="w-full rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200" placeholder="Ej. De los semáforos 2c al lago..." />
          </div>
        )}
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
  )
}
