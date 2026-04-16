'use client'

import { useState, useActionState, useEffect } from 'react'
import Link from 'next/link'
import { updateContract, annulContract, deleteContract, type ContractActionState } from '../../../../actions/contracts'
import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { formatCurrency } from '@/lib/utils'

function sanitizeTemplateHtml(html: string): string {
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/\s+on\w+\s*=\s*["'][^"']*["']/gi, '')
    .replace(/\s+on\w+\s*=\s*[^\s>]+/gi, '')
    .replace(/href\s*=\s*["']javascript:[^"']*["']/gi, 'href="#"')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    .replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, '')
}

type Shift = {
  id: string
  name: string
  start_time: string
  end_time: string
}

type JobPosition = {
  id: string
  name: string
  company_id: string
  parent_id: string | null
}

type Branch = {
  id: string
  name: string
  company_id: string
}

interface ContractFormProps {
  id: string
  initialData: any
  shifts: Shift[]
  jobPositions: JobPosition[]
  branches?: Branch[]
  templateContent?: string | null
  employee?: any
}

export function ContractForm({ id, initialData, shifts, jobPositions, branches = [], templateContent = null, employee = {} }: ContractFormProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  
  // Tab State
  const [activeTab, setActiveTab] = useState<1 | 2 | 3>(1)
  
  // Form State
  const [selectedBranch, setSelectedBranch] = useState<string>(initialData.branch_id || '')
  const [selectedPosition, setSelectedPosition] = useState<string>(initialData.job_position_id || '')
  const [contractType, setContractType] = useState<string>(initialData.contract_type || 'Indefinido')
  const [salary, setSalary] = useState<string>(initialData.salary?.toString() || '0')
  const [startDate, setStartDate] = useState<string>(initialData.start_date || '')
  const [endDate, setEndDate] = useState<string>(initialData.end_date || '')
  const [hireDate, setHireDate] = useState<string>(initialData.hire_date ? (typeof initialData.hire_date === 'string' ? initialData.hire_date.split('T')[0] : initialData.hire_date) : '')
  const [socialSecurity, setSocialSecurity] = useState<string>(initialData.social_security_number || '')
  const [selectedShift, setSelectedShift] = useState<string>(initialData.shift_template_id || '')
  const [status, setStatus] = useState<string>(initialData.status || 'active')
  
  const [previewHtml, setPreviewHtml] = useState<string>('')

  const [state, action, pending] = useActionState<ContractActionState, FormData>(
    updateContract.bind(null, id),
    null
  )

  const selectedJob = jobPositions.find(p => p.id === selectedPosition)
  const parentJob = jobPositions.find(p => p.id === selectedJob?.parent_id)
  
  const selectedShiftData = shifts.find(s => s.id === selectedShift)

  // Live PDF Engine
  useEffect(() => {
    if (!templateContent || !employee.id) return
    let content = templateContent
    
    // El formateador recibe los datos en crudo (numérico) y el template los espera ya en formato NIO C$
    const formattedSalary = formatCurrency(Number(salary) || 0)
    
    const replacements: Record<string, string> = {
      '{{full_name}}': `${employee.first_name || ''} ${employee.last_name || ''}`,
      '{{salary}}': formattedSalary,
      '{{shift_name}}': selectedShiftData?.name || 'N/A',
      '{{shift_start}}': selectedShiftData?.start_time || 'N/A',
      '{{contract_type}}': contractType || 'N/A',
      '{{start_date}}': startDate ? new Date(startDate).toLocaleDateString() : 'N/A',
      '{{employee_number}}': employee.employee_number || 'Pendiente'
    }

    Object.entries(replacements).forEach(([key, value]) => {
      const safeValue = value.replace(/\{\{|\}\}/g, '')
      content = content.replace(new RegExp(key.replace(/[{}]/g, '\\$&'), 'g'), safeValue)
    })

    setPreviewHtml(sanitizeTemplateHtml(content))
  }, [templateContent, employee, salary, selectedShiftData, contractType, startDate])

  const handleAnnul = async () => {
    if (!confirm('¿Estás seguro de anular este contrato? Esta acción lo marcará como no activo.')) return
    startTransition(async () => {
      const res = await annulContract(id)
      if (res.error) alert(res.error)
      else router.push('/contracts')
    })
  }

  const handleDelete = async () => {
    if (!confirm('¿Estás seguro de ELIMINAR permanentemente este contrato?')) return
    startTransition(async () => {
      const res = await deleteContract(id)
      if (res.error) alert(res.error)
      else router.push('/contracts')
    })
  }

  return (
    <form action={action} className="space-y-8 flex flex-col min-h-[600px]">
      {/* Dynamic Hidden Inputs ensuring data is sent regardless of active tab */}
      <input type="hidden" name="contract_type" value={contractType} />
      <input type="hidden" name="salary" value={salary} />
      <input type="hidden" name="start_date" value={startDate} />
      <input type="hidden" name="end_date" value={endDate} />
      <input type="hidden" name="hire_date" value={hireDate} />
      <input type="hidden" name="social_security_number" value={socialSecurity} />
      <input type="hidden" name="shift_template_id" value={selectedShift} />
      <input type="hidden" name="status" value={status} />
      <input type="hidden" name="job_position_id" value={selectedPosition} />
      <input type="hidden" name="branch_id" value={selectedBranch} />

      {state?.error && (
        <div className="rounded-2xl bg-red-50 p-4 text-sm text-red-600 ring-1 ring-red-200">
          {state.error}
        </div>
      )}

      {/* Tabs Header */}
      <div className="flex flex-col sm:flex-row items-center gap-2 rounded-3xl bg-slate-100 p-1.5 mb-6 shadow-inner">
        {[
          { id: 1, label: 'Organización', icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4' },
          { id: 2, label: 'Legal y Remuneración', icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z' },
          { id: 3, label: 'Documento Legal (PDF)', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' }
        ].map(tab => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex w-full sm:w-auto flex-1 items-center justify-center gap-2 rounded-2xl py-3 px-4 text-sm font-bold transition-all duration-300 ${
              activeTab === tab.id 
                ? 'bg-white text-slate-900 shadow-md ring-1 ring-slate-200/50 scale-[1.02]' 
                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50/50'
            }`}
          >
            <svg className="h-5 w-5 opacity-70" fill="none" viewBox="0 0 24 24" stroke="currentColor">
               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={tab.icon} />
            </svg>
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex-1">
        {/* Tab 1: Organización */}
        {activeTab === 1 && (
          <div className="space-y-8 animate-in fade-in zoom-in-[0.98] duration-300">
            <h2 className="text-xl font-black tracking-tight text-slate-900">Estructura Organizacional</h2>
            <div className="grid gap-6 sm:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-bold text-slate-700 uppercase tracking-wider">Sucursal</label>
                <select 
                  value={selectedBranch}
                  onChange={e => setSelectedBranch(e.target.value)}
                  className="h-12 w-full rounded-2xl border-2 border-slate-200 bg-slate-50 px-4 text-sm font-bold text-slate-900 outline-none transition-all hover:bg-white focus:border-slate-900 focus:bg-white focus:ring-4 focus:ring-slate-100"
                >
                  <option value="">Seleccione sucursal</option>
                  {branches.map(b => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-2 block text-sm font-bold text-slate-700 uppercase tracking-wider">Puesto de Trabajo</label>
                <select 
                  value={selectedPosition}
                  onChange={(e) => setSelectedPosition(e.target.value)}
                  className="h-12 w-full rounded-2xl border-2 border-slate-200 bg-slate-50 px-4 text-sm font-bold text-slate-900 outline-none transition-all hover:bg-white focus:border-slate-900 focus:bg-white focus:ring-4 focus:ring-slate-100"
                  required
                >
                  <option value="">Seleccionar puesto</option>
                  {jobPositions.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
                {selectedPosition && parentJob && (
                  <div className="mt-3 flex items-center gap-2 rounded-xl bg-indigo-50 px-3 py-2 border border-indigo-100 animate-in slide-in-from-top-2">
                    <svg className="h-4 w-4 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M7 11l5-5m0 0l5 5m-5-5v12" />
                    </svg>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-700">Jerarquía: Reporta a {parentJob.name}</span>
                  </div>
                )}
              </div>
            </div>
            
            <div className="pt-4 border-t border-slate-100">
               <label className="mb-2 block text-sm font-bold text-slate-700 uppercase tracking-wider">Estado del Contrato</label>
               <select 
                 value={status}
                 onChange={e => setStatus(e.target.value)}
                 className="h-12 w-full max-w-xs rounded-2xl border-2 border-slate-200 bg-slate-50 px-4 text-sm font-bold text-slate-900 outline-none transition-all hover:bg-white focus:border-slate-900 focus:bg-white focus:ring-4 focus:ring-slate-100"
               >
                 <option value="active">Activo</option>
                 <option value="annulled">Anulado</option>
                 <option value="expired">Vencido</option>
                 <option value="terminated">Terminado</option>
               </select>
            </div>
          </div>
        )}

        {/* Tab 2: Legal y Remuneración */}
        {activeTab === 2 && (
          <div className="space-y-8 animate-in fade-in zoom-in-[0.98] duration-300">
            <h2 className="text-xl font-black tracking-tight text-slate-900">Condiciones Contractuales</h2>
            <div className="grid gap-6 sm:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-bold text-slate-700 uppercase tracking-wider">Tipo de Contrato</label>
                <select 
                  value={contractType}
                  onChange={e => setContractType(e.target.value)}
                  className="h-12 w-full rounded-2xl border-2 border-slate-200 bg-slate-50 px-4 text-sm font-bold text-slate-900 outline-none transition-all hover:bg-white focus:border-slate-900 focus:bg-white"
                >
                  <option value="Indefinido">Indefinido</option>
                  <option value="Temporal">Temporal (Obra/Servicio)</option>
                  <option value="Servicios Prof.">Servicios Profesionales</option>
                  <option value="Pasantía">Pasantía</option>
                </select>
              </div>
              <div>
                <label className="mb-2 block text-sm font-bold text-slate-700 uppercase tracking-wider">Salario Mensual Bruto</label>
                <input 
                  type="number" 
                  value={salary}
                  onChange={e => setSalary(e.target.value)}
                  className="h-12 w-full rounded-2xl border-2 border-slate-200 bg-slate-50 px-4 text-sm font-bold text-slate-900 outline-none transition-all hover:bg-white focus:border-slate-900 focus:bg-white" 
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-bold text-slate-700 uppercase tracking-wider">Fecha de Inicio / Firma</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    const val = e.target.value
                    setStartDate(val)
                    if (!hireDate || hireDate === startDate) setHireDate(val)
                  }}
                  className="h-12 w-full rounded-2xl border-2 border-slate-200 bg-slate-50 px-4 text-sm font-bold text-slate-900 outline-none transition-all hover:bg-white focus:border-slate-900 focus:bg-white"
                />
              </div>
              <div className={contractType === 'Indefinido' ? 'opacity-50 pointer-events-none' : 'animate-in fade-in zoom-in-95'}>
                <label className="mb-2 block text-sm font-bold text-slate-700 uppercase tracking-wider">Fecha de Finalización</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={e => setEndDate(e.target.value)}
                  className="h-12 w-full rounded-2xl border-2 border-blue-200 bg-blue-50 px-4 text-sm font-bold text-blue-900 outline-none transition-all hover:bg-white focus:border-blue-700 focus:ring-4 focus:ring-blue-100"
                />
              </div>
              
              <div className="sm:col-span-2 pt-4 border-t border-slate-100">
                <div className="grid gap-6 sm:grid-cols-2">
                  <div>
                    <label className="mb-2 flex justify-between text-sm font-bold text-slate-700 uppercase tracking-wider">
                      <span>Número INSS</span>
                      {!socialSecurity && <span className="text-[9px] uppercase font-black tracking-widest text-orange-500 bg-orange-100 px-2 py-0.5 rounded-full ring-1 ring-orange-200 pt-1">Automático: Pendiente Gracia</span>}
                    </label>
                    <input
                      type="text"
                      value={socialSecurity}
                      onChange={e => setSocialSecurity(e.target.value)}
                      placeholder="Ej: 12345-67890-123K"
                      className="h-12 w-full rounded-2xl border-2 border-slate-200 bg-slate-50 px-4 text-sm font-bold text-slate-900 outline-none transition-all hover:bg-white focus:border-slate-900 focus:bg-white"
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-bold text-slate-700 uppercase tracking-wider">Fecha de Alta (Sistema / Nómina)</label>
                    <input
                      type="date"
                      value={hireDate}
                      readOnly
                      className="h-12 w-full rounded-2xl border-2 border-slate-200 bg-slate-100/50 px-4 text-sm font-bold text-slate-500 cursor-not-allowed outline-none"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-6 border-t border-slate-100">
              <label className="mb-2 block text-sm font-bold text-slate-700 uppercase tracking-wider">Turno Asignado (Fijo)</label>
              <select 
                value={selectedShift}
                onChange={e => setSelectedShift(e.target.value)}
                className="h-12 w-full rounded-2xl border-2 border-slate-200 bg-slate-50 px-4 text-sm font-bold text-slate-900 outline-none transition-all hover:bg-white focus:border-slate-900 focus:bg-white focus:ring-4 focus:ring-slate-100"
                required
              >
                <option value="">Seleccionar turno</option>
                {shifts.map(shift => (
                  <option key={shift.id} value={shift.id}>
                    {shift.name} ({shift.start_time.substring(0,5)} - {shift.end_time.substring(0,5)})
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* Tab 3: Documento Legal (PDF) */}
        {activeTab === 3 && (
          <div className="animate-in fade-in zoom-in-[0.98] duration-300 space-y-4">
             <div className="flex justify-between items-center mb-6 px-2">
                <div>
                   <h2 className="text-xl font-black tracking-tight text-slate-900">Live Preview</h2>
                   <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Motor de Reportes Gestor360</p>
                </div>
                <div className="flex items-center gap-2 text-xs font-bold text-emerald-700 bg-emerald-50 px-4 py-2 rounded-full border border-emerald-200 shadow-sm">
                   <span className="relative flex h-2.5 w-2.5">
                     <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                     <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                   </span>
                   Sincronizado
                </div>
             </div>
             
             {templateContent ? (
               <div className="w-full bg-slate-200/50 p-4 sm:p-10 rounded-3xl overflow-hidden shadow-inner flex justify-center border border-slate-300 relative">
                  {/* Decorative corner accents for realism */}
                  <div className="absolute top-0 left-0 w-16 h-16 border-t-4 border-l-4 border-slate-300/50 rounded-tl-3xl m-4 mix-blend-multiply"></div>
                  
                  {/* The A4 Canvas */}
                  <div className="w-full max-w-[210mm] bg-white shadow-2xl p-[15mm] sm:p-[20mm] font-serif text-slate-900 leading-relaxed overflow-x-auto min-h-[297mm] transition-all duration-500">
                    <div className="flex justify-between items-start mb-12 border-b-2 border-slate-900 pb-6">
                      <div className="space-y-1">
                         <h1 className="text-3xl font-black uppercase tracking-tighter">Contrato de Trabajo</h1>
                         <p className="text-xs text-slate-500 font-sans font-bold uppercase tracking-widest">Documento Preliminar</p>
                      </div>
                      <div className="text-xs font-sans font-black text-slate-300 px-3 py-1 border-2 border-slate-200 rounded-lg">
                        BORRADOR
                      </div>
                    </div>
                    {/* Live HTML Box */}
                    <div 
                      className="prose prose-sm prose-slate max-w-none whitespace-pre-wrap text-[11pt]"
                      dangerouslySetInnerHTML={{ __html: previewHtml }}
                    />
                  </div>
               </div>
             ) : (
               <div className="p-20 text-center border-2 border-dashed border-slate-300 rounded-3xl bg-slate-50">
                 <svg className="h-12 w-12 text-slate-300 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                 </svg>
                 <p className="text-slate-500 font-bold font-sans">No hay plantilla de contrato base configurada.</p>
                 <p className="text-slate-400 text-sm mt-2">Visita la sección de Plantillas Legales para crear una.</p>
               </div>
             )}
          </div>
        )}
      </div>

      {/* Global Master Save Action */}
      <div className="mt-8 flex flex-wrap items-center justify-end gap-3 pt-6 border-t border-slate-200 sticky bottom-6 bg-white/80 backdrop-blur-xl p-4 rounded-3xl ring-1 ring-slate-200 shadow-xl z-20">
        <Link 
          href={`/contracts/${id}/print`}
          className="rounded-2xl border-2 border-slate-200 bg-white px-5 py-3.5 text-sm font-bold text-slate-700 transition-all hover:bg-slate-50 hover:border-slate-300 flex items-center gap-2 active:scale-95"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
          </svg>
          Exportar PDF Actual
        </Link>

        {initialData.status !== 'annulled' && (
          <button
            type="button"
            onClick={handleAnnul}
            disabled={isPending}
            className="rounded-2xl border-2 border-orange-200 bg-orange-50 px-5 py-3.5 text-sm font-bold text-orange-700 transition hover:bg-orange-100 disabled:opacity-50 active:scale-95"
          >
            Anular
          </button>
        )}

        <button
          type="button"
          onClick={handleDelete}
          disabled={isPending || initialData.is_printed}
          className="rounded-2xl border-2 border-red-200 bg-red-50 px-5 py-3.5 text-sm font-bold text-red-700 transition hover:bg-red-100 disabled:opacity-50 active:scale-95"
          title={initialData.is_printed ? "No se puede eliminar un contrato impreso" : "Eliminar permanentemente"}
        >
          Eliminar
        </button>

        <div className="flex-1 hidden lg:block" />

        <Link 
          href="/contracts" 
          className="rounded-2xl px-6 py-3.5 text-sm font-bold text-slate-500 transition hover:bg-slate-100 active:scale-95"
        >
          Cancelar
        </Link>
        <button
          type="submit"
          disabled={pending || isPending}
          className="rounded-2xl bg-blue-600 px-10 py-3.5 text-sm font-black tracking-wide text-white shadow-xl shadow-blue-500/20 transition-all hover:bg-blue-700 hover:shadow-blue-500/40 disabled:opacity-50 active:scale-95 flex items-center gap-2"
        >
          {pending ? (
            <>
              <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Guardando Sistemas...
            </>
          ) : (
             <>
               <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
               </svg>
               Actualizar Contrato
             </>
          )}
        </button>
      </div>
    </form>
  )
}
