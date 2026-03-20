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

type Company = {
  id: string
  display_name: string
  abbreviation: string
}

type Branch = {
  id: string
  name: string
  code: string
  company_id: string
}

type JobPosition = {
  id: string
  name: string
  company_id: string
}

export function HiringWizard({ 
  initialEmployees,
  companies,
  branches,
  jobPositions
}: { 
  initialEmployees: Employee[]
  companies: Company[]
  branches: Branch[]
  jobPositions: JobPosition[]
}) {
  const [step, setStep] = useState(1)
  const [shifts, setShifts] = useState<Shift[]>([])
  const [loadingShifts, setLoadingShifts] = useState(false)
  const [selectedEmployee, setSelectedEmployee] = useState<string>('')
  const [selectedCompany, setSelectedCompany] = useState<string>('')
  const [selectedBranch, setSelectedBranch] = useState<string>('')
  const [selectedPosition, setSelectedPosition] = useState<string>('')
  const [selectedShift, setSelectedShift] = useState<string>('')
  
  const [state, action, pending] = useActionState<ContractActionState, FormData>(createContract, null)

  const filteredBranches = branches.filter((b: Branch) => b.company_id === selectedCompany)
  const filteredPositions = jobPositions.filter((p: JobPosition) => p.company_id === selectedCompany)

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
        {[1, 2, 3, 4, 5].map((s) => (
          <div key={s} className="flex flex-1 items-center last:flex-none">
            <div className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold transition ${
              step >= s ? 'bg-slate-900 text-white shadow-lg' : 'bg-slate-100 text-slate-400'
            }`}>
              {s}
            </div>
            {s < 5 && (
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
        <div className={step === 1 ? 'space-y-4 animate-in fade-in slide-in-from-bottom-2' : 'hidden'}>
          <h2 className="text-xl font-bold text-slate-900">Selección de Empleado</h2>
          <p className="text-sm text-slate-500">¿Para quién es este contrato?</p>
          
          <div className="grid gap-3 max-h-[400px] overflow-y-auto pr-2">
            {initialEmployees.map((emp) => (
              <label 
                key={emp.id}
                className={`flex cursor-pointer items-center justify-between rounded-2xl border-2 p-4 transition ${
                  selectedEmployee === emp.id 
                    ? 'border-slate-900 bg-slate-100 ring-1 ring-slate-900' 
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
                    className="h-5 w-5 accent-slate-900" 
                    required
                  />
                  <div>
                    <p className="font-bold text-slate-900">{emp.first_name} {emp.last_name}</p>
                    <p className="text-xs text-slate-600 font-medium">{emp.email || 'Sin correo'}</p>
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

        {/* Step 2: Company & Branch Selection */}
        <div className={step === 2 ? 'space-y-6 animate-in fade-in slide-in-from-bottom-2' : 'hidden'}>
          <h2 className="text-xl font-bold text-slate-900">Empresa y Sucursal</h2>
          <p className="text-sm text-slate-500">Define dónde trabajará el colaborador.</p>

          <div className="space-y-4">
            <div>
              <label className="mb-2 block text-sm font-bold text-slate-900">Seleccionar Empresa</label>
              <div className="grid gap-3 sm:grid-cols-2">
                {companies.map((co) => (
                  <label 
                    key={co.id}
                    className={`flex cursor-pointer items-center gap-3 rounded-2xl border-2 p-4 transition ${
                      selectedCompany === co.id ? 'border-slate-900 bg-slate-50 ring-1 ring-slate-900' : 'border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <input 
                      type="radio" 
                      name="company_id" 
                      value={co.id}
                      checked={selectedCompany === co.id}
                      onChange={() => {
                        setSelectedCompany(co.id)
                        setSelectedBranch('') // Reset branch when company changes
                        setSelectedPosition('') // Reset position when company changes
                      }}
                      className="h-5 w-5 accent-slate-900" 
                      required
                    />
                    <span className="font-bold text-slate-900">{co.display_name}</span>
                  </label>
                ))}
              </div>
            </div>

            {selectedCompany && (
              <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
                <div>
                  <label className="mb-2 block text-sm font-bold text-slate-900">Seleccionar Sucursal</label>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {filteredBranches.map((br: Branch) => (
                      <label 
                        key={br.id}
                        className={`flex cursor-pointer items-center gap-3 rounded-2xl border-2 p-4 transition ${
                          selectedBranch === br.id ? 'border-slate-900 bg-slate-50 ring-1 ring-slate-900' : 'border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        <input 
                          type="radio" 
                          name="branch_id" 
                          value={br.id}
                          checked={selectedBranch === br.id}
                          onChange={() => setSelectedBranch(br.id)}
                          className="h-5 w-5 accent-slate-900" 
                          required
                        />
                        <span className="font-bold text-slate-900">{br.name}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {filteredPositions.length > 0 ? (
                  <div>
                    <label className="mb-2 block text-sm font-bold text-slate-900">Puesto de Trabajo</label>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {filteredPositions.map((p: JobPosition) => (
                        <label 
                          key={p.id}
                          className={`flex cursor-pointer items-center gap-3 rounded-2xl border-2 p-4 transition ${
                            selectedPosition === p.id ? 'border-slate-900 bg-slate-50 ring-1 ring-slate-900' : 'border-slate-200 hover:bg-slate-50'
                          }`}
                        >
                          <input 
                            type="radio" 
                            name="job_position_id" 
                            value={p.id}
                            checked={selectedPosition === p.id}
                            onChange={() => setSelectedPosition(p.id)}
                            className="h-5 w-5 accent-slate-900" 
                            required
                          />
                          <span className="font-bold text-slate-900">{p.name}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="rounded-2xl bg-amber-50 p-4 border border-amber-200">
                    <p className="text-sm font-bold text-amber-800">No hay puestos definidos para esta empresa.</p>
                    <Link href="/organization/jobs/new" className="text-xs font-bold text-amber-900 underline mt-1 block">Configurar puestos ahora</Link>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Step 3: Terms */}
        <div className={step === 3 ? 'space-y-4 animate-in fade-in slide-in-from-bottom-2' : 'hidden'}>
          <h2 className="text-xl font-bold text-slate-900">Términos del Contrato</h2>
          <div className="grid gap-6 sm:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-bold text-slate-900">Tipo de Contrato</label>
              <select 
                name="contract_type" 
                className="h-12 w-full rounded-2xl border-2 border-slate-300 bg-white px-4 text-sm font-bold text-slate-900 outline-none focus:border-slate-900"
              >
                <option value="Indefinido">Indefinido</option>
                <option value="Temporal">Temporal (Obra/Servicio)</option>
                <option value="Servicios Prof.">Servicios Profesionales</option>
                <option value="Pasantía">Pasantía</option>
              </select>
            </div>
            <div>
              <label className="mb-2 block text-sm font-bold text-slate-900">Salario Mensual</label>
              <input 
                type="number" 
                name="salary" 
                placeholder="0.00" 
                defaultValue="0"
                className="h-12 w-full rounded-2xl border-2 border-slate-300 bg-white px-4 text-sm font-bold text-slate-900 outline-none focus:border-slate-900" 
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-bold text-slate-900">Fecha de Inicio</label>
              <input 
                type="date" 
                name="start_date" 
                defaultValue={new Date().toISOString().split('T')[0]}
                className="h-12 w-full rounded-2xl border-2 border-slate-300 bg-white px-4 text-sm font-bold text-slate-900 outline-none focus:border-slate-900" 
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-bold text-slate-900">Fecha de Cierre (Opcional)</label>
              <input 
                type="date" 
                name="end_date" 
                className="h-12 w-full rounded-2xl border-2 border-slate-300 bg-white px-4 text-sm font-bold text-slate-900 outline-none focus:border-slate-900" 
              />
            </div>
          </div>
        </div>

        {/* Step 4: Shift Assignment */}
        <div className={step === 4 ? 'space-y-4 animate-in fade-in slide-in-from-bottom-2' : 'hidden'}>
          <h2 className="text-xl font-bold text-slate-900">Asignación de Turno</h2>
          <p className="text-sm text-slate-500">Este vínculo es obligatorio para la marcación.</p>
          
          {loadingShifts ? (
            <p className="py-8 text-center text-sm text-slate-500 italic">Cargando turnos desde el servidor...</p>
          ) : (
            <div className="grid gap-3 max-h-[400px] overflow-y-auto pr-2">
              {shifts.map((shift) => (
                <label 
                  key={shift.id}
                  className={`flex cursor-pointer items-center gap-4 rounded-2xl border-2 p-5 transition shadow-sm ${
                    selectedShift === shift.id 
                      ? 'border-slate-900 bg-slate-50 ring-1 ring-slate-900' 
                      : 'border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <input 
                    type="radio" 
                    name="schedule_id" 
                    value={shift.id} 
                    checked={selectedShift === shift.id}
                    onChange={() => setSelectedShift(shift.id)}
                    className="h-6 w-6 accent-slate-900" 
                    required
                  />
                  <div className="flex-1">
                    <p className="font-bold text-slate-900">{shift.name}</p>
                    <p className="text-sm font-medium text-slate-600 font-mono">
                      {shift.start_time.substring(0,5)} - {shift.end_time.substring(0,5)}
                    </p>
                  </div>
                </label>
              ))}
            </div>
          )}
        </div>

        {/* Step 5: Finalize & Preview */}
        <div className={step === 5 ? 'space-y-6 animate-in zoom-in-95' : 'hidden'}>
          <div className="text-center space-y-2">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-slate-900 text-white shadow-xl">
              <span className="text-2xl font-bold italic">G</span>
            </div>
            <h2 className="text-2xl font-bold text-slate-900">Vista Previa</h2>
            <p className="text-sm text-slate-500">Revisa los datos antes de formalizar la contratación.</p>
          </div>
          
          <div className="rounded-3xl border-2 border-slate-200 bg-white p-8 shadow-sm space-y-6 max-h-[500px] overflow-y-auto">
            <div className="border-b-2 border-slate-100 pb-4 flex justify-between items-center">
              <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400">Contrato Laboral Dynamico</h3>
              <span className="text-[10px] font-bold bg-slate-200 px-2 py-1 rounded tracking-tighter uppercase text-slate-700">Draft</span>
            </div>
            
            <div className="space-y-4 text-sm leading-relaxed text-slate-900 font-medium">
              <p>
                Yo, <span className="font-bold">GESTOR360 S.A.</span>, formalizo la contratación de <span className="font-bold text-slate-900 underline">{initialEmployees.find(e => e.id === selectedEmployee)?.first_name} {initialEmployees.find(e => e.id === selectedEmployee)?.last_name}</span> bajo la modalidad de <span className="font-bold">Contrato Laboral</span>.
              </p>
              <p>
                El colaborador cumplirá las funciones de <span className="font-bold">{jobPositions.find((p: JobPosition) => p.id === selectedPosition)?.name}</span> en <span className="font-bold text-slate-900">{branches.find((b: Branch) => b.id === selectedBranch)?.name}</span> según lo establecido en el turno <span className="font-bold">{shifts.find((s: Shift) => s.id === selectedShift)?.name || 'Seleccionado'}</span>.
              </p>
              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 flex items-center justify-between">
                <div>
                  <p className="text-[10px] text-slate-400 font-bold uppercase">Empresa Contratante</p>
                  <p className="text-sm font-bold text-slate-900">{companies.find(c => c.id === selectedCompany)?.display_name}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-slate-400 font-bold uppercase">PIN de Marcación</p>
                  <p className="text-sm font-mono font-bold text-slate-900">Se generará automáticamente</p>
                </div>
              </div>
              <p className="pt-4 border-t border-slate-100 italic text-xs text-slate-500">
                * Al hacer clic en finalizar, el sistema generará el Número de Empleado y el PIN para el Kiosko.
              </p>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between pt-6 border-t border-slate-100">
          {step > 1 ? (
            <button type="button" onClick={prevStep} className="flex h-12 items-center justify-center rounded-2xl px-6 text-sm font-bold text-slate-700 transition hover:bg-slate-100">
              Atrás
            </button>
          ) : (
            <Link href="/contracts" className="flex h-12 items-center justify-center rounded-2xl px-6 text-sm font-bold text-slate-700 transition hover:bg-slate-100">
              Cancelar
            </Link>
          )}

          {step < 5 ? (
            <button 
              type="button" 
              onClick={nextStep} 
              disabled={
                (step === 1 && !selectedEmployee) || 
                (step === 2 && (!selectedCompany || !selectedBranch || !selectedPosition)) || 
                (step === 4 && !selectedShift)
              }
              className="flex h-12 items-center justify-center rounded-2xl bg-slate-900 px-8 text-sm font-bold text-white shadow-xl transition hover:bg-slate-800 disabled:opacity-50 active:scale-95"
            >
              Siguiente
            </button>
          ) : (
            <button 
              type="submit" 
              disabled={pending}
              className="flex h-12 items-center justify-center rounded-2xl bg-slate-900 px-10 text-sm font-bold text-white shadow-xl shadow-slate-300 transition hover:bg-slate-800 disabled:opacity-50 active:scale-95"
            >
              {pending ? 'Procesando...' : 'Finalizar y Contratar'}
            </button>
          )}
        </div>
      </form>
    </div>
  )
}
