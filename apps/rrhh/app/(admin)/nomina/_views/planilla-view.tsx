'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getNicaISODate } from '@/lib/date-utils'

interface PlanillaViewProps {
  start?: string
  end?: string
  branch?: string
}

interface PlanillaRow {
  employee_id: string
  full_name: string
  employee_code: string
  contract_type: string
  salary: number
  days_worked: number
  total_hours: number
  late_minutes: number
  daily_rate: number
  earned: number
  deduction_amount: number
  net_salary: number
}

export function PlanillaView({ start, end, branch }: PlanillaViewProps) {
  const [rows, setRows] = useState<PlanillaRow[]>([])
  const [branches, setBranches] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const supabase = createClient()

  const today = getNicaISODate()
  const defaultStart = start || today.slice(0, 7) + '-01'
  const defaultEnd = end || today

  const [filterStart, setFilterStart] = useState(defaultStart)
  const [filterEnd, setFilterEnd] = useState(defaultEnd)
  const [filterBranch, setFilterBranch] = useState(branch || 'all')

  async function fetchData(s: string, e: string, b: string) {
    setLoading(true)

    const { data: branchesData } = await supabase.from('branches').select('id, name').order('name')
    setBranches(branchesData || [])

    // 1. Attendance aggregated by employee
    let attQuery = supabase
      .from('consolidated_attendance_view')
      .select('employee_id, full_name, employee_code, net_hours, late_minutes, attendance_date, branch_id')
      .gte('attendance_date', s)
      .lte('attendance_date', e)

    if (b && b !== 'all') attQuery = attQuery.eq('branch_id', b)

    const { data: attData } = await attQuery

    // 2. Contracts for salary info
    const { data: contractsData } = await supabase
      .from('contracts')
      .select('employee_id, salary, contract_type')
      .eq('status', 'active')

    const contractMap: Record<string, { salary: number; contract_type: string }> = {}
    contractsData?.forEach((c: any) => {
      contractMap[c.employee_id] = { salary: c.salary || 0, contract_type: c.contract_type || 'N/A' }
    })

    // 3. Aggregate
    const empMap: Record<string, PlanillaRow> = {}
    attData?.forEach((r: any) => {
      if (!empMap[r.employee_id]) {
        const contract = contractMap[r.employee_id] || { salary: 0, contract_type: 'N/A' }
        empMap[r.employee_id] = {
          employee_id: r.employee_id,
          full_name: r.full_name,
          employee_code: r.employee_code,
          contract_type: contract.contract_type,
          salary: contract.salary,
          days_worked: 0,
          total_hours: 0,
          late_minutes: 0,
          daily_rate: contract.salary / 30,
          earned: 0,
          deduction_amount: 0,
          net_salary: 0,
        }
      }
      empMap[r.employee_id].days_worked += 1
      empMap[r.employee_id].total_hours += r.net_hours || 0
      empMap[r.employee_id].late_minutes += r.late_minutes || 0
    })

    // 4. Calculate financials
    const finalRows = Object.values(empMap).map((row) => {
      const earned = row.days_worked * row.daily_rate
      const deduction = (row.late_minutes / 60) * (row.daily_rate / 8)
      return {
        ...row,
        total_hours: parseFloat(row.total_hours.toFixed(2)),
        earned: parseFloat(earned.toFixed(2)),
        deduction_amount: parseFloat(deduction.toFixed(2)),
        net_salary: parseFloat((earned - deduction).toFixed(2)),
      }
    })

    finalRows.sort((a, b) => a.full_name.localeCompare(b.full_name))
    setRows(finalRows)
    setLoading(false)
  }

  useEffect(() => {
    fetchData(filterStart, filterEnd, filterBranch)
  }, [])

  function handleFilter(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const s = fd.get('start') as string
    const en = fd.get('end') as string
    const b = fd.get('branch') as string
    setFilterStart(s)
    setFilterEnd(en)
    setFilterBranch(b)
    fetchData(s, en, b)
  }

  function openPDF() {
    const url = `/nomina/print?type=planilla&start=${filterStart}&end=${filterEnd}&branch=${filterBranch}`
    window.open(url, '_blank', 'width=1000,height=800')
  }

  async function saveCierre() {
    if (rows.length === 0) return
    setSaving(true)
    const { data: profile } = await supabase.auth.getUser()
    const { data: profileData } = await supabase
      .from('profiles')
      .select('company_id')
      .eq('id', profile.user?.id)
      .single()

    const totalAmount = rows.reduce((s, r) => s + r.net_salary, 0)
    const totalHours = rows.reduce((s, r) => s + r.total_hours, 0)
    const totalDays = rows.reduce((s, r) => s + r.days_worked, 0)

    await supabase.from('payroll_closures').insert({
      company_id: profileData?.company_id,
      branch_id: filterBranch !== 'all' ? filterBranch : null,
      period_start: filterStart,
      period_end: filterEnd,
      status: 'draft',
      total_employees: rows.length,
      total_days: totalDays,
      total_hours: totalHours,
      total_amount: totalAmount,
      created_by: profile.user?.id,
    })
    setSaving(false)
    alert('Cierre guardado como borrador en la pestaña "Cierres de Período".')
  }

  const totalEarned = rows.reduce((s, r) => s + r.earned, 0)
  const totalDeductions = rows.reduce((s, r) => s + r.deduction_amount, 0)
  const totalNet = rows.reduce((s, r) => s + r.net_salary, 0)

  return (
    <section className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 app-surface p-6">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Nómina</p>
          <h1 className="mt-2 text-3xl font-black text-white tracking-tight">Planilla de Nómina</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">
            Cálculo salarial por período basado en asistencia real.
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <button
            onClick={openPDF}
            disabled={rows.length === 0}
            className="flex h-10 items-center gap-2 rounded-xl bg-slate-800 border border-slate-700 px-4 text-[11px] font-black uppercase tracking-widest text-slate-300 transition hover:bg-slate-700 disabled:opacity-40"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
            Ver PDF
          </button>
          <button
            onClick={saveCierre}
            disabled={rows.length === 0 || saving}
            className="flex h-10 items-center gap-2 rounded-xl bg-blue-500 px-4 text-[11px] font-black uppercase tracking-widest text-white shadow-lg shadow-blue-500/20 transition hover:bg-blue-600 disabled:opacity-40"
          >
            {saving ? (
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
            )}
            Guardar Cierre
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="app-surface p-6">
        <form onSubmit={handleFilter} className="grid gap-4 sm:grid-cols-4">
          <div>
            <label className="mb-2 block text-[10px] font-black uppercase tracking-widest text-slate-400">Desde</label>
            <input type="date" name="start" defaultValue={filterStart} className="h-10 w-full rounded-xl border border-slate-700 bg-slate-800/50 px-3 text-sm text-white outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" />
          </div>
          <div>
            <label className="mb-2 block text-[10px] font-black uppercase tracking-widest text-slate-400">Hasta</label>
            <input type="date" name="end" defaultValue={filterEnd} className="h-10 w-full rounded-xl border border-slate-700 bg-slate-800/50 px-3 text-sm text-white outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" />
          </div>
          <div>
            <label className="mb-2 block text-[10px] font-black uppercase tracking-widest text-slate-400">Sucursal</label>
            <select name="branch" defaultValue={filterBranch} className="h-10 w-full rounded-xl border border-slate-700 bg-slate-800/50 px-3 text-sm text-white outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20">
              <option value="all">Todas</option>
              {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
          <div className="flex items-end">
            <button type="submit" className="h-10 w-full rounded-xl bg-slate-700 text-[11px] font-black uppercase tracking-widest text-white transition hover:bg-slate-600">
              Calcular
            </button>
          </div>
        </form>
      </div>

      {/* Summary Cards */}
      {!loading && rows.length > 0 && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            { label: 'Empleados', value: rows.length.toString(), color: 'text-white' },
            { label: 'Total Devengado', value: `C$ ${totalEarned.toLocaleString('es-NI', { minimumFractionDigits: 2 })}`, color: 'text-emerald-400' },
            { label: 'Deducciones', value: `C$ ${totalDeductions.toLocaleString('es-NI', { minimumFractionDigits: 2 })}`, color: 'text-amber-400' },
            { label: 'Neto a Pagar', value: `C$ ${totalNet.toLocaleString('es-NI', { minimumFractionDigits: 2 })}`, color: 'text-blue-400' },
          ].map(card => (
            <div key={card.label} className="app-surface p-5">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{card.label}</p>
              <p className={`mt-2 text-2xl font-black ${card.color}`}>{card.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="flex h-32 items-center justify-center app-surface">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
        </div>
      ) : (
        <div className="app-surface overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="border-b border-slate-700/50 bg-slate-800 text-[10px] font-black uppercase tracking-widest text-slate-400">
                <th className="px-6 py-4">Empleado</th>
                <th className="px-6 py-4">Tipo</th>
                <th className="px-6 py-4 text-center">Días</th>
                <th className="px-6 py-4 text-center">Horas</th>
                <th className="px-6 py-4 text-right">Salario Base</th>
                <th className="px-6 py-4 text-right">Devengado</th>
                <th className="px-6 py-4 text-right">Deducciones</th>
                <th className="px-6 py-4 text-right">Neto</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {rows.length > 0 ? (
                rows.map(row => (
                  <tr key={row.employee_id} className="hover:bg-slate-800/50 transition">
                    <td className="px-6 py-4">
                      <p className="font-bold text-white">{row.full_name}</p>
                      <p className="text-[10px] font-mono text-slate-500 uppercase">{row.employee_code}</p>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{row.contract_type}</span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="inline-block rounded-lg bg-slate-700 px-2 py-1 text-[11px] font-black text-white">{row.days_worked}</span>
                    </td>
                    <td className="px-6 py-4 text-center font-mono text-slate-300">{row.total_hours}</td>
                    <td className="px-6 py-4 text-right font-mono text-slate-400">C$ {row.salary.toLocaleString('es-NI', { minimumFractionDigits: 2 })}</td>
                    <td className="px-6 py-4 text-right font-mono text-emerald-400">C$ {row.earned.toLocaleString('es-NI', { minimumFractionDigits: 2 })}</td>
                    <td className="px-6 py-4 text-right font-mono text-amber-400">C$ {row.deduction_amount.toLocaleString('es-NI', { minimumFractionDigits: 2 })}</td>
                    <td className="px-6 py-4 text-right">
                      <span className="text-lg font-black text-blue-400">C$ {row.net_salary.toLocaleString('es-NI', { minimumFractionDigits: 2 })}</span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-slate-500 text-sm font-medium">
                    No hay datos para el período seleccionado.
                  </td>
                </tr>
              )}
            </tbody>
            {rows.length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-slate-600 bg-slate-800/80 text-[11px] font-black uppercase tracking-widest">
                  <td colSpan={5} className="px-6 py-4 text-slate-400">TOTALES</td>
                  <td className="px-6 py-4 text-right text-emerald-400">C$ {totalEarned.toLocaleString('es-NI', { minimumFractionDigits: 2 })}</td>
                  <td className="px-6 py-4 text-right text-amber-400">C$ {totalDeductions.toLocaleString('es-NI', { minimumFractionDigits: 2 })}</td>
                  <td className="px-6 py-4 text-right text-blue-400">C$ {totalNet.toLocaleString('es-NI', { minimumFractionDigits: 2 })}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}
    </section>
  )
}
