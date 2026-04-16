'use client'

import { useState, useEffect } from 'react'
import { useActionState } from 'react'
import Link from 'next/link'
import { createContract, type ContractActionState } from '../../../actions/contracts'
import { useDirtyState } from '@/hooks/useDirtyState'
import { DirtyStateGuard } from '@/components/ui/DirtyStateGuard'

type Shift = {
  id: string
  name: string
  start_time: string
  end_time: string
  branch_id?: string
}

type Employee = {
  id: string
  first_name: string
  last_name: string
  email: string
  is_active: boolean
  photo_url?: string
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
  parent_id: string | null
  icon_name: string | null
}

export function HiringWizard({ 
  initialEmployees,
  branches,
  jobPositions
}: { 
  initialEmployees: Employee[]
  companies: Company[]
  branches: Branch[]
  jobPositions: JobPosition[]
}) {
  const [step, setStep] = useState(1)
  const [allShifts, setAllShifts] = useState<Shift[]>([])
  
  const [selectedEmployee, setSelectedEmployee] = useState<string>('')
  const [selectedBranch, setSelectedBranch] = useState<string>('')
  const [selectedPosition, setSelectedPosition] = useState<string>('')
  const [hireDate, setHireDate] = useState<string>(new Date().toISOString().split('T')[0])
  
  const [socialSecurityNumber, setSocialSecurityNumber] = useState<string>('')
  const [contractType, setContractType] = useState<string>('Indefinido')
  const [selectedShift, setSelectedShift] = useState<string>('')
  const [salary, setSalary] = useState<string>('0')
  const [endDate, setEndDate] = useState<string>('')

  // Dirty State Guard
  const { 
    isDirty, 
    showExitGuard, 
    handleAttemptClose, 
    cancelExit, 
    confirmExit, 
    checkDirty
  } = useDirtyState({
    onClose: () => { window.location.href = '/contracts' },
    initialState: {
      selectedEmployee: '',
      selectedBranch: '',
      selectedPosition: '',
      selectedShift: '',
      socialSecurityNumber: '',
    }
  })

  useEffect(() => {
    checkDirty({
      selectedEmployee,
      selectedBranch,
      selectedPosition,
      selectedShift,
      socialSecurityNumber,
    })
  }, [selectedEmployee, selectedBranch, selectedPosition, selectedShift, socialSecurityNumber, checkDirty])
  
  const [state, action, pending] = useActionState<ContractActionState, FormData>(createContract, null)

  const selectedJob = jobPositions.find(p => p.id === selectedPosition)
  const autoCompanyId = branches.find(b => b.id === selectedBranch)?.company_id || ''

  const filteredPositions = selectedBranch 
    ? jobPositions.filter(p => p.company_id === autoCompanyId)
    : []

  const visibleShifts = allShifts.filter(s => !s.branch_id || s.branch_id === selectedBranch)

  useEffect(() => {
    async function loadShifts() {
      try {
        const res = await fetch('/api/v1/schedules')
        const data = await res.json()
        setAllShifts(data.data || [])
      } catch (e) {
        console.error('Error loading shifts:', e)
      }
    }
    loadShifts()
  }, [])

  const nextStep = () => setStep(step + 1)
  const prevStep = () => setStep(step - 1)

  const employeeInfo = initialEmployees.find(e => e.id === selectedEmployee)
  const branchInfo = branches.find(b => b.id === selectedBranch)
  const positionInfo = jobPositions.find(p => p.id === selectedPosition)

  // Calculate duration if Definido
  const durationMonths = (contractType === 'Definido' && hireDate && endDate) 
    ? Math.max(0, Math.round((new Date(endDate).getTime() - new Date(hireDate).getTime()) / (1000 * 60 * 60 * 24 * 30)))
    : null

  return (
    <div className="space-y-8">
      {/* Progress Bar */}
      <div className="flex items-center justify-between px-2">
        {['Organización', 'Legal y Remuneración', 'Ejecución'].map((label, i) => {
          const s = i + 1;
          return (
            <div key={s} className="flex flex-col items-center">
              <div className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold transition ${
                step >= s ? 'bg-slate-900 text-white shadow-lg' : 'bg-slate-100 text-slate-400'
              }`}>
                {s}
              </div>
              <span className={`text-[10px] mt-2 font-bold uppercase tracking-wider ${step >= s ? 'text-slate-900' : 'text-slate-400'}`}>{label}</span>
            </div>
          )
        })}
      </div>

      <form action={action} className="space-y-6 block">
        {state?.error && (
          <div className="rounded-2xl bg-red-50 p-4 text-sm text-red-600 ring-1 ring-red-200">
            {state.error}
          </div>
        )}

        {/* Hidden Fields mapped to DB constraints */}
        <input type="hidden" name="employee_id" value={selectedEmployee} />
        <input type="hidden" name="branch_id" value={selectedBranch} />
        <input type="hidden" name="job_position_id" value={selectedPosition} />
        <input type="hidden" name="company_id" value={autoCompanyId} />
        <input type="hidden" name="shift_template_id" value={selectedShift} />
        <input type="hidden" name="hire_date" value={hireDate} />
        <input type="hidden" name="start_date" value={hireDate} />
        <input type="hidden" name="contract_type" value={contractType} />
        {contractType === 'Definido' && <input type="hidden" name="end_date" value={endDate} />}
        <input type="hidden" name="salary" value={salary} />
        <input type="hidden" name="social_security_number" value={socialSecurityNumber} />
        
        {/* Step 1: Organization */}
        <div className={step === 1 ? 'space-y-6 animate-in fade-in slide-in-from-bottom-2' : 'hidden'}>
          <h2 className="text-xl font-bold text-slate-900">Configuración Organizacional</h2>
          
          <div className="grid gap-6">
            <div>
              <label className="mb-2 block text-sm font-bold text-slate-900">Empleado a Contratar</label>
              <select 
                value={selectedEmployee}
                onChange={(e) => setSelectedEmployee(e.target.value)}
                className="h-12 w-full rounded-2xl border-2 border-slate-300 bg-white px-4 text-sm font-bold text-slate-900 outline-none focus:border-slate-900"
              >
                <option value="">Seleccione el colaborador</option>
                {initialEmployees.map(emp => (
                  <option key={emp.id} value={emp.id}>{emp.first_name} {emp.last_name}</option>
                ))}
              </select>
            </div>

            <div className="grid sm:grid-cols-2 gap-6">
              <div>
                <label className="mb-2 block text-sm font-bold text-slate-900">Sucursal (Principal)</label>
                <select 
                  value={selectedBranch}
                  onChange={(e) => setSelectedBranch(e.target.value)}
                  className="h-12 w-full rounded-2xl border-2 border-slate-300 bg-white px-4 text-sm font-bold text-slate-900 outline-none focus:border-slate-900"
                >
                  <option value="">Seleccione una sucursal</option>
                  {branches.map(br => (
                    <option key={br.id} value={br.id}>{br.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-bold text-slate-900">Puesto (Dependiente)</label>
                <select 
                  value={selectedPosition}
                  onChange={(e) => setSelectedPosition(e.target.value)}
                  disabled={!selectedBranch}
                  className="h-12 w-full rounded-2xl border-2 border-slate-300 bg-white px-4 text-sm font-bold text-slate-900 outline-none focus:border-slate-900 disabled:opacity-50"
                >
                  <option value="">{selectedBranch ? 'Seleccione un puesto' : 'Seleccione sucursal primero'}</option>
                  {filteredPositions.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-bold text-slate-900">Fecha de Contratación</label>
              <input
                type="date"
                value={hireDate}
                onChange={(e) => setHireDate(e.target.value)}
                className="h-12 w-full rounded-2xl border-2 border-slate-300 bg-white px-4 text-sm font-bold text-slate-900 outline-none focus:border-slate-900"
              />
            </div>
          </div>
        </div>

        {/* Step 2: Legal & Compensation */}
        <div className={step === 2 ? 'space-y-6 animate-in fade-in slide-in-from-bottom-2' : 'hidden'}>
          <h2 className="text-xl font-bold text-slate-900">Legal y Remuneración</h2>

          <div className="grid gap-6 sm:grid-cols-2">
            <div>
              <label className="mb-2 flex justify-between text-sm font-bold text-slate-900">
                <span>Número INSS</span>
                {!socialSecurityNumber && <span className="text-[10px] uppercase font-black tracking-wider text-orange-500 bg-orange-100 px-2 py-0.5 rounded-full">Trámite inicial</span>}
              </label>
              <input
                type="text"
                value={socialSecurityNumber}
                onChange={(e) => setSocialSecurityNumber(e.target.value)}
                placeholder="Opcional si es primer empleo"
                className="h-12 w-full rounded-2xl border-2 border-slate-300 bg-white px-4 text-sm font-bold text-slate-900 outline-none focus:border-slate-900"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-bold text-slate-900">Salario Mensual (Córdobas/Dólares)</label>
              <input 
                type="number" 
                value={salary}
                onChange={(e) => setSalary(e.target.value)}
                placeholder="0.00" 
                className="h-12 w-full rounded-2xl border-2 border-slate-300 bg-white px-4 text-sm font-bold text-slate-900 outline-none focus:border-slate-900" 
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-bold text-slate-900">Tipo de Contrato</label>
              <select 
                value={contractType}
                onChange={(e) => setContractType(e.target.value)}
                className="h-12 w-full rounded-2xl border-2 border-slate-300 bg-white px-4 text-sm font-bold text-slate-900 outline-none focus:border-slate-900"
              >
                <option value="Indefinido">Indefinido</option>
                <option value="Definido">Definido</option>
                <option value="Servicios Prof.">Servicios Profesionales</option>
                <option value="Pasantía">Pasantía</option>
              </select>
            </div>

            {contractType === 'Definido' && (
              <div className="animate-in fade-in zoom-in-95">
                <label className="mb-2 flex justify-between text-sm font-bold text-slate-900">
                  <span>Fecha de Finalización</span>
                  {durationMonths !== null && <span className="text-xs text-blue-600 font-bold">{durationMonths} meses</span>}
                </label>
                <input 
                  type="date" 
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="h-12 w-full rounded-2xl border-2 border-blue-300 bg-blue-50 px-4 text-sm font-bold text-blue-900 outline-none focus:border-blue-600 ring-2 ring-blue-500/20" 
                />
              </div>
            )}
            
            <div className="sm:col-span-2">
              <label className="mb-2 block text-sm font-bold text-slate-900">Turno de Trabajo (Filtrado por Sucursal)</label>
              <select 
                value={selectedShift}
                onChange={(e) => setSelectedShift(e.target.value)}
                className="h-12 w-full rounded-2xl border-2 border-slate-300 bg-white px-4 text-sm font-bold text-slate-900 outline-none focus:border-slate-900"
              >
                <option value="">Seleccione un turno</option>
                {visibleShifts.map(s => (
                  <option key={s.id} value={s.id}>{s.name} ({s.start_time.substring(0,5)} - {s.end_time.substring(0,5)})</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Step 3: Execution / Summary */}
        <div className={step === 3 ? 'space-y-6 animate-in slide-in-from-bottom-2' : 'hidden'}>
          <h2 className="text-xl font-bold text-slate-900">Confirmación y Ejecución</h2>
          <p className="text-sm text-slate-500">Verifica los datos antes de emitir el contrato. Esto generará su PIN de acceso.</p>
          
          {employeeInfo && branchInfo && positionInfo && (
            <div className="relative overflow-hidden rounded-3xl border-2 border-slate-200 bg-white shadow-sm flex flex-col md:flex-row max-w-lg mx-auto">
              <div className="bg-slate-900 p-6 md:w-1/3 flex flex-col items-center justify-center text-center">
                <div className="h-20 w-20 rounded-full bg-slate-800 border-2 border-slate-700 flex items-center justify-center overflow-hidden mb-3">
                  {employeeInfo.photo_url ? (
                    <img src={employeeInfo.photo_url} alt="Profile" className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-2xl font-black text-slate-400">{employeeInfo.first_name[0]}{employeeInfo.last_name[0]}</span>
                  )}
                </div>
                <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-full ${!socialSecurityNumber ? 'bg-orange-500/20 text-orange-400' : 'bg-green-500/20 text-green-400'}`}>
                  {!socialSecurityNumber ? "GRACIA INSS" : "INSS ACTIVO"}
                </span>
              </div>
              <div className="p-6 md:w-2/3 flex flex-col justify-center space-y-4">
                <div>
                  <h3 className="text-lg font-black text-slate-900 leading-tight">{employeeInfo.first_name} {employeeInfo.last_name}</h3>
                  <p className="text-sm font-bold text-slate-500">{positionInfo.name}</p>
                </div>
                
                <div className="space-y-2">
                  <div className="flex justify-between border-b border-slate-100 pb-2">
                    <span className="text-xs font-bold text-slate-400 uppercase">Sucursal</span>
                    <span className="text-sm font-bold text-slate-900">{branchInfo.name}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-100 pb-2">
                    <span className="text-xs font-bold text-slate-400 uppercase">Contrato</span>
                    <span className="text-sm font-bold text-slate-900">{contractType}</span>
                  </div>
                  <div className="flex justify-between pb-2">
                    <span className="text-xs font-bold text-slate-400 uppercase">Salario Inicial</span>
                    <span className="text-sm font-bold text-green-600">${Number(salary).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                  </div>
                </div>
                
                <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                  <p className="text-xs font-bold text-slate-500 mb-1">Acción del Sistema:</p>
                  <p className="text-sm font-medium text-slate-700">Se generará un PIN de 4 dígitos y el estado pasará a <b>Activo</b> al confirmar.</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between pt-6 border-t border-slate-100">
          {step > 1 ? (
            <button type="button" onClick={prevStep} className="flex h-12 items-center justify-center rounded-2xl px-6 text-sm font-bold text-slate-700 transition hover:bg-slate-100">
              Atrás
            </button>
          ) : (
            <Link 
              href="/contracts" 
              onClick={(e) => {
                if (isDirty) {
                  e.preventDefault()
                  handleAttemptClose()
                }
              }}
              className="flex h-12 items-center justify-center rounded-2xl px-6 text-sm font-bold text-slate-700 transition hover:bg-slate-100"
            >
              Cancelar
            </Link>
          )}

          {step < 3 ? (
            <button
              type="button"
              onClick={nextStep}
              disabled={
                (step === 1 && (!selectedEmployee || !selectedBranch || !selectedPosition || !hireDate)) ||
                (step === 2 && (!selectedShift || (contractType === 'Definido' && !endDate)))
              }
              className="flex h-12 items-center justify-center rounded-2xl bg-slate-900 px-8 text-sm font-bold text-white shadow-xl transition hover:bg-slate-800 disabled:opacity-50 active:scale-95"
            >
              Siguiente
            </button>
          ) : (
            <button
              type="submit"
              disabled={pending}
              className="flex h-12 items-center justify-center rounded-2xl bg-blue-600 px-10 text-sm font-bold text-white shadow-xl shadow-blue-300 transition hover:bg-blue-700 disabled:opacity-50 active:scale-95"
            >
              {pending ? 'Procesando...' : 'Confirmar Contratación'}
            </button>
          )}
        </div>
      </form>

      <DirtyStateGuard 
        show={showExitGuard}
        onConfirm={confirmExit}
        onCancel={cancelExit}
      />
    </div>
  )
}
