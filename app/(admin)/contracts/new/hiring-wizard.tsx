'use client'

import { useState, useEffect } from 'react'
import { useActionState } from 'react'
import Link from 'next/link'
import { createContract, type ContractActionState } from '../../../actions/contracts'

type Shift = {
  id: string
  name: string
  start_time: string
  end_time: string
}

type Employee = {
  id: string
  first_name: string
  last_name: string
  email: string
  is_active: boolean
}

export function HiringWizard({ initialEmployees }: { initialEmployees: Employee[] }) {
  const [step, setStep] = useState(1)
  const [shifts, setShifts] = useState<Shift[]>([])
  const [loadingShifts, setLoadingShifts] = useState(false)
  const [selectedEmployee, setSelectedEmployee] = useState<string>('')
  
  const [state, action, pending] = useActionState<ContractActionState, FormData>(createContract, null)

  useEffect(() => {
    async function loadShifts() {
      setLoadingShifts(true)
      try {
        const res = await fetch('/api/v1/schedules')
        const data = await res.json()
        setShifts(data.data || [])
      } catch (e) {
        console.error('Error loading shifts:', e)
      } finally {
        setLoadingShifts(false)
      }
    }
    loadShifts()
  }, [])

  const nextStep = () => setStep(step + 1)
  const prevStep = () => setStep(step - 1)

  return (
    <div className="space-y-8">
      {/* Progress Bar */}
      <div className="flex items-center justify-between px-2">
        {[1, 2, 3, 4].map((s) => (
          <div key={s} className="flex flex-1 items-center last:flex-none">
            <div className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold transition ${
              step >= s ? 'bg-slate-900 text-white shadow-lg' : 'bg-slate-100 text-slate-400'
            }`}>
              {s}
            </div>
            {s < 4 && (
              <div className={`h-1 flex-1 mx-2 rounded-full transition ${
                step > s ? 'bg-slate-900' : 'bg-slate-100'
              }`} />
            )}
          </div>
        ))}
      </div>

      <form action={action} className="space-y-6">
        {state?.error && (
          <div className="rounded-2xl bg-red-50 p-4 text-sm text-red-600 ring-1 ring-red-200">
            {state.error}
          </div>
        )}

        {/* Step 1: Employee Selection */}
        {step === 1 && (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
            <h2 className="text-xl font-bold text-slate-900">Selección de Empleado</h2>
            <p className="text-sm text-slate-500">¿Para quién es este contrato?</p>
            
            <div className="grid gap-3 max-h-[400px] overflow-y-auto pr-2">
              {initialEmployees.map((emp) => (
                <label 
                  key={emp.id}
                  className={`flex cursor-pointer items-center justify-between rounded-2xl border p-4 transition ${
                    selectedEmployee === emp.id 
                      ? 'border-slate-900 bg-slate-50 ring-1 ring-slate-900' 
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <input 
                      type="radio" 
                      name="employee_id" 
                      value={emp.id}
                      checked={selectedEmployee === emp.id}
                      onChange={() => setSelectedEmployee(emp.id)}
                      className="h-4 w-4 accent-slate-900" 
                    />
                    <div>
                      <p className="font-semibold text-slate-900">{emp.first_name} {emp.last_name}</p>
                      <p className="text-xs text-slate-500">{emp.email || 'Sin correo'}</p>
                    </div>
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                    emp.is_active ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'
                  }`}>
                    {emp.is_active ? 'Activo' : 'Pendiente'}
                  </span>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Step 2: Terms */}
        {step === 2 && (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
            <h2 className="text-xl font-bold text-slate-900">Términos del Contrato</h2>
            <div className="grid gap-6 sm:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-900">Tipo de Contrato</label>
                <select name="contract_type" className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none outline-none focus:border-slate-400">
                  <option value="Indefinido">Indefinido</option>
                  <option value="Temporal">Temporal (Obra/Servicio)</option>
                  <option value="Servicios Prof.">Servicios Profesionales</option>
                  <option value="Pasantía">Pasantía</option>
                </select>
              </div>
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-900">Salario Mensual</label>
                <input type="number" name="salary" placeholder="0.00" className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none focus:border-slate-400" />
              </div>
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-900">Fecha de Inicio</label>
                <input type="date" name="start_date" className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none focus:border-slate-400" />
              </div>
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-900">Fecha de Cierre (Opcional)</label>
                <input type="date" name="end_date" className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none focus:border-slate-400" />
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Shift Assignment (using API) */}
        {step === 3 && (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
            <h2 className="text-xl font-bold text-slate-900">Asignación de Turno</h2>
            <p className="text-sm text-slate-500">Este vínculo es obligatorio para la marcación.</p>
            
            {loadingShifts ? (
              <p className="py-8 text-center text-sm text-slate-500 italic">Cargando turnos desde el servidor...</p>
            ) : (
              <div className="grid gap-3">
                {shifts.map((shift) => (
                  <label 
                    key={shift.id}
                    className="flex cursor-pointer items-center gap-4 rounded-2xl border border-slate-200 p-5 transition hover:bg-slate-50 has-[:checked]:border-slate-900 has-[:checked]:ring-1 has-[:checked]:ring-slate-900 shadow-sm"
                  >
                    <input type="radio" name="schedule_id" value={shift.id} className="h-5 w-5 accent-slate-900" required />
                    <div className="flex-1">
                      <p className="font-bold text-slate-900">{shift.name}</p>
                      <p className="text-sm text-slate-500">{shift.start_time} - {shift.end_time}</p>
                    </div>
                  </label>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Step 4: Finalize & Preview */}
        {step === 4 && (
          <div className="space-y-6 animate-in zoom-in-95">
            <div className="text-center space-y-2">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-slate-900 text-white">
                <span className="text-2xl font-bold italic">G</span>
              </div>
              <h2 className="text-2xl font-bold text-slate-900">Vista Previa</h2>
              <p className="text-sm text-slate-500">Revisa los datos antes de formalizar la contratación.</p>
            </div>
            
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-8 shadow-sm space-y-6 max-h-[500px] overflow-y-auto">
              <div className="border-b border-slate-200 pb-4 flex justify-between items-center">
                <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400">Contrato Laboral Dynamico</h3>
                <span className="text-[10px] font-bold bg-slate-200 px-2 py-1 rounded tracking-tighter uppercase">Draft</span>
              </div>
              
              <div className="space-y-4 text-sm leading-relaxed text-slate-600">
                <p>
                  Yo, **GESTOR360 S.A.**, formalizo la contratación de **{initialEmployees.find(e => e.id === selectedEmployee)?.first_name} {initialEmployees.find(e => e.id === selectedEmployee)?.last_name}** 
                  bajo la modalidad de **Contrato Indefinido**.
                </p>
                <p>
                  El colaborador desempeñará sus funciones en el horario **{shifts.find(s => s.id === (state as any)?.schedule_id || true)?.name || 'Turno Seleccionado'}** 
                  ({shifts.find(s => s.id)?.start_time} - {shifts.find(s => s.id)?.end_time}), 
                  cumpliendo con las políticas de asistencia y puntualidad establecidas.
                </p>
                <p className="pt-4 border-t border-slate-200 italic text-xs">
                  * Al hacer clic en finalizar, el sistema habilitará el PIN automático para el Kiosko de marcación.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between pt-6 border-t border-slate-100">
          {step > 1 ? (
            <button type="button" onClick={prevStep} className="flex h-12 items-center justify-center rounded-2xl px-6 text-sm font-semibold text-slate-600 transition hover:bg-slate-50">
              Atrás
            </button>
          ) : (
            <Link href="/contracts" className="flex h-12 items-center justify-center rounded-2xl px-6 text-sm font-semibold text-slate-600 transition hover:bg-slate-50">
              Cancelar
            </Link>
          )}

          {step < 4 ? (
            <button 
              type="button" 
              onClick={nextStep} 
              disabled={step === 1 && !selectedEmployee}
              className="flex h-12 items-center justify-center rounded-2xl bg-slate-900 px-8 text-sm font-semibold text-white shadow-xl transition hover:bg-slate-800 disabled:opacity-50 active:scale-95"
            >
              Siguiente
            </button>
          ) : (
            <button 
              type="submit" 
              disabled={pending}
              className="flex h-12 items-center justify-center rounded-2xl bg-slate-900 px-10 text-sm font-semibold text-white shadow-xl shadow-slate-200 transition hover:bg-slate-800 disabled:opacity-50 active:scale-95"
            >
              {pending ? 'Procesando...' : 'Finalizar y Contratar'}
            </button>
          )}
        </div>
      </form>
    </div>
  )
}
