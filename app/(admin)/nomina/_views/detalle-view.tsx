'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getNicaISODate } from '@/lib/date-utils'

interface DetalleViewProps {
  start?: string
  end?: string
  employee?: string
}

export function DetalleView({ start, end, employee }: DetalleViewProps) {
  const [employees, setEmployees] = useState<any[]>([])
  const [records, setRecords] = useState<any[]>([])
  const [contract, setContract] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  const today = getNicaISODate()
  const [filterStart, setFilterStart] = useState(start || today.slice(0, 7) + '-01')
  const [filterEnd, setFilterEnd] = useState(end || today)
  const [filterEmployee, setFilterEmployee] = useState(employee || '')

  const supabase = createClient()

  useEffect(() => {
    supabase.from('employees').select('id, first_name, last_name, employee_code').eq('is_active', true).order('last_name')
      .then(({ data }) => setEmployees(data || []))
  }, [])

  async function fetchDetail(empId: string, s: string, e: string) {
    if (!empId) return
    setLoading(true)

    const [{ data: att }, { data: con }] = await Promise.all([
      supabase
        .from('consolidated_attendance_view')
        .select('*')
        .eq('employee_id', empId)
        .gte('attendance_date', s)
        .lte('attendance_date', e)
        .order('attendance_date', { ascending: true }),
      supabase
        .from('contracts')
        .select('salary, contract_type, inss_number')
        .eq('employee_id', empId)
        .eq('status', 'active')
        .single(),
    ])

    setRecords(att || [])
    setContract(con)
    setLoading(false)
  }

  function handleFilter(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const s = fd.get('start') as string
    const en = fd.get('end') as string
    const emp = fd.get('employee') as string
    setFilterStart(s)
    setFilterEnd(en)
    setFilterEmployee(emp)
    fetchDetail(emp, s, en)
  }

  function openPDF() {
    const url = `/nomina/print?type=detalle&start=${filterStart}&end=${filterEnd}&employee=${filterEmployee}`
    window.open(url, '_blank', 'width=1000,height=800')
  }

  const totalHours = records.reduce((s, r) => s + (r.net_hours || 0), 0)
  const totalLate = records.reduce((s, r) => s + (r.late_minutes || 0), 0)
  const dailyRate = contract ? contract.salary / 30 : 0
  const earned = records.length * dailyRate
  const deduction = (totalLate / 60) * (dailyRate / 8)

  return (
    <section className="space-y-6">
      <div className="flex items-start justify-between gap-4 app-surface p-6">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Nómina</p>
          <h1 className="mt-2 text-3xl font-black text-white tracking-tight">Detalle por Empleado</h1>
          <p className="mt-3 text-sm leading-6 text-slate-400">Marcaciones y cálculo individual día a día.</p>
        </div>
        {records.length > 0 && (
          <button
            onClick={openPDF}
            className="flex h-10 items-center gap-2 rounded-xl bg-slate-800 border border-slate-700 px-4 text-[11px] font-black uppercase tracking-widest text-slate-300 transition hover:bg-slate-700"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
            Ver PDF
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="app-surface p-6">
        <form onSubmit={handleFilter} className="grid gap-4 sm:grid-cols-4">
          <div>
            <label className="mb-2 block text-[10px] font-black uppercase tracking-widest text-slate-400">Empleado</label>
            <select name="employee" defaultValue={filterEmployee} className="h-10 w-full rounded-xl border border-slate-700 bg-slate-800/50 px-3 text-sm text-white outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20">
              <option value="">Seleccionar...</option>
              {employees.map(emp => (
                <option key={emp.id} value={emp.id}>{emp.first_name} {emp.last_name} ({emp.employee_code})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-2 block text-[10px] font-black uppercase tracking-widest text-slate-400">Desde</label>
            <input type="date" name="start" defaultValue={filterStart} className="h-10 w-full rounded-xl border border-slate-700 bg-slate-800/50 px-3 text-sm text-white outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" />
          </div>
          <div>
            <label className="mb-2 block text-[10px] font-black uppercase tracking-widest text-slate-400">Hasta</label>
            <input type="date" name="end" defaultValue={filterEnd} className="h-10 w-full rounded-xl border border-slate-700 bg-slate-800/50 px-3 text-sm text-white outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" />
          </div>
          <div className="flex items-end">
            <button type="submit" className="h-10 w-full rounded-xl bg-slate-700 text-[11px] font-black uppercase tracking-widest text-white transition hover:bg-slate-600">
              Ver Detalle
            </button>
          </div>
        </form>
      </div>

      {/* Contract Info */}
      {contract && records.length > 0 && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            { label: 'Salario Mensual', value: `C$ ${Number(contract.salary).toLocaleString('es-NI', { minimumFractionDigits: 2 })}`, color: 'text-white' },
            { label: 'Total Horas', value: `${totalHours.toFixed(2)} hrs`, color: 'text-slate-300' },
            { label: 'Tardanzas', value: `${totalLate} min`, color: totalLate > 0 ? 'text-amber-400' : 'text-emerald-400' },
            { label: 'Neto Estimado', value: `C$ ${(earned - deduction).toLocaleString('es-NI', { minimumFractionDigits: 2 })}`, color: 'text-blue-400' },
          ].map(card => (
            <div key={card.label} className="app-surface p-5">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{card.label}</p>
              <p className={`mt-2 text-xl font-black ${card.color}`}>{card.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Detail Table */}
      {loading ? (
        <div className="flex h-32 items-center justify-center app-surface">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
        </div>
      ) : records.length > 0 ? (
        <div className="app-surface overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="border-b border-slate-700/50 bg-slate-800 text-[10px] font-black uppercase tracking-widest text-slate-400">
                <th className="px-6 py-4">Fecha</th>
                <th className="px-6 py-4">Entrada</th>
                <th className="px-6 py-4">Salida</th>
                <th className="px-6 py-4 text-center">Horas Netas</th>
                <th className="px-6 py-4 text-center">Tardanza</th>
                <th className="px-6 py-4 text-center">Turno</th>
                <th className="px-6 py-4">Observación</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {records.map((r, i) => {
                const clockIn = r.clock_in ? new Date(r.clock_in) : null
                const clockOut = r.clock_out ? new Date(r.clock_out) : null
                const isLate = (r.late_minutes || 0) > 0
                const isMissing = r.missing_clock_out

                return (
                  <tr key={i} className="hover:bg-slate-800/50 transition">
                    <td className="px-6 py-4 font-mono text-white">
                      {new Date(r.attendance_date).toLocaleDateString('es-NI', { weekday: 'short', day: '2-digit', month: '2-digit' })}
                    </td>
                    <td className="px-6 py-4 font-mono text-slate-300">
                      {clockIn ? clockIn.toLocaleTimeString('es-NI', { hour: '2-digit', minute: '2-digit', hour12: true }) : '—'}
                    </td>
                    <td className="px-6 py-4 font-mono text-slate-400">
                      {clockOut ? clockOut.toLocaleTimeString('es-NI', { hour: '2-digit', minute: '2-digit', hour12: true }) : (
                        isMissing ? <span className="text-red-400 text-[10px] font-black uppercase">Falta salida</span> : '—'
                      )}
                    </td>
                    <td className="px-6 py-4 text-center font-mono font-bold text-white">
                      {(r.net_hours || 0).toFixed(2)}
                    </td>
                    <td className="px-6 py-4 text-center">
                      {isLate ? (
                        <span className="text-[10px] font-black text-amber-400">{r.late_minutes} min</span>
                      ) : (
                        <span className="text-[10px] font-black text-emerald-400">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-center text-[10px] text-slate-500 font-bold uppercase">
                      {r.shift_name}
                    </td>
                    <td className="px-6 py-4 text-[11px] text-slate-500">{r.observations}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : filterEmployee ? (
        <div className="app-surface p-12 text-center">
          <p className="text-slate-500 text-sm font-medium">Sin registros para el período.</p>
        </div>
      ) : (
        <div className="app-surface p-12 text-center">
          <p className="text-slate-500 text-sm font-medium">Selecciona un empleado para ver su detalle.</p>
        </div>
      )}
    </section>
  )
}
