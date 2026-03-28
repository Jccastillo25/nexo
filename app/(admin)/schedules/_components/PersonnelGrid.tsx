'use client'

import React, { useState, useEffect } from 'react'
import ShiftCell from './ShiftCell'
import { getResolvedPersonnelSchedule, pinShift } from '../../../actions/schedules'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { AlertCircle } from 'lucide-react'

interface Employee {
  id: string
  first_name: string
  last_name: string
  employee_code: string | null
  branch_id: string | null
  job_position_id?: string | null
}

interface PersonnelGridProps {
  companyId: string
  branchId: string
  startDate?: string
}

export default function PersonnelGrid({
  companyId,
  branchId,
  startDate
}: PersonnelGridProps) {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<{
    employees: Employee[]
    dates: string[]
    grid: Record<string, any>
  } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const loadData = async () => {
    setLoading(true)
    setError(null)
    const res = await getResolvedPersonnelSchedule(companyId, branchId, startDate)
    if ('error' in res) {
      setError(res.error || 'Error al cargar datos')
    } else if (res.success) {
      setData(res.data)
    }
    setLoading(false)
  }

  useEffect(() => {
    loadData()
  }, [companyId, branchId, startDate])

  const handlePin = async (empId: string, date: string, templateId: string) => {
    setError(null)
    const res = await pinShift(empId, date, templateId, companyId)
    if ('error' in res) {
      setError(res.error || 'Error al fijar turno')
    } else {
      loadData()
    }
  }

  const handleDrop = async (empId: string, date: string, templateId: string | null) => {
    // In Personnel Matrix, dropping a template creates an Override (Level 1)
    if (!templateId) {
      // If null, we'd need a way to clear the override. 
      // For now, let's just use it to fix/override.
      return
    }
    await handlePin(empId, date, templateId)
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-slate-200 border-t-slate-900 rounded-full" />
      </div>
    )
  }

  if (!data || data.employees.length === 0) {
    return (
      <div className="rounded-3xl border-2 border-dashed border-slate-200 p-12 text-center text-slate-500">
        No se encontraron empleados para esta selección.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="flex items-center gap-2 rounded-2xl bg-red-50 p-4 text-sm text-red-600 ring-1 ring-red-200 animate-in fade-in slide-in-from-top-2">
          <AlertCircle size={16} />
          <p className="font-medium">{error}</p>
        </div>
      )}

      <div className="overflow-x-auto rounded-3xl border border-slate-200 bg-white shadow-sm">
      <table className="w-full border-collapse">
        <thead>
          <tr className="bg-slate-50/50">
            <th className="sticky left-0 z-10 border-b border-r border-slate-200 bg-slate-50/80 p-4 text-left text-xs font-black uppercase tracking-widest text-slate-500 backdrop-blur-sm w-64">
              Empleado
            </th>
            {data.dates.map((dateStr) => {
              const dateObj = new Date(dateStr + 'T12:00:00') // Avoid TZ issues
              return (
                <th key={dateStr} className="border-b border-slate-200 p-4 text-center min-w-[140px]">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                    {format(dateObj, 'EEEE', { locale: es })}
                  </p>
                  <p className="text-sm font-bold text-slate-700">
                    {format(dateObj, 'dd MMM', { locale: es })}
                  </p>
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody>
          {data.employees.map((emp) => (
            <tr key={emp.id} className="hover:bg-slate-50/30 transition">
              <td className="sticky left-0 z-10 border-r border-slate-200 bg-white/80 p-4 backdrop-blur-sm">
                <p className="font-bold text-slate-900">{emp.first_name} {emp.last_name}</p>
                <p className="text-[10px] text-slate-500 font-medium">PIN: {emp.employee_code || '---'}</p>
              </td>
              {data.dates.map((dateStr) => {
                const key = `${emp.id}_${dateStr}`
                const resolved = data.grid[key]
                return (
                  <td key={dateStr} className="p-2 border-b border-slate-100">
                    <ShiftCell
                      entityId={emp.id} // Reusing as empId
                      dayOfWeek={new Date(dateStr).getDay()}
                      template={resolved ? {
                        id: resolved.shift_id,
                        name: resolved.name,
                        start_time: resolved.start_time,
                        end_time: resolved.end_time,
                        color_code: resolved.color_code
                      } : null}
                      onDrop={async (_, __, tId) => handleDrop(emp.id, dateStr, tId)}
                      isDraggedOver={true}
                      draggedTemplate={null}
                      isSelected={false}
                      onSelect={() => {}}
                      sourceLevel={resolved?.source_level}
                      sourceName={resolved?.source_name}
                      onPin={resolved && resolved.source_level > 2 ? () => handlePin(emp.id, dateStr, resolved.shift_id) : undefined}
                    />
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </div>
  )
}
