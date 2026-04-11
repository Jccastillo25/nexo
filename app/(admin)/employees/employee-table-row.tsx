'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { deleteEmployee } from '../../actions/employees'

interface EmployeeTableRowProps {
  emp: any
}

function StatusBadge({ active }: { active: boolean }) {
  return (
    <span
      className={`inline-block rounded-lg px-2.5 py-1 text-[10px] font-black uppercase tracking-widest border ${
        active
          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
          : 'bg-slate-500/10 text-slate-400 border-slate-500/20'
      }`}
    >
      {active ? 'Activo' : 'Inactivo'}
    </span>
  )
}

function PinBadge({ hasPin }: { hasPin: boolean }) {
  return (
    <span
      className={`inline-block rounded-lg px-2.5 py-1 text-[10px] font-black uppercase tracking-widest border ${
        hasPin
          ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
          : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
      }`}
    >
      {hasPin ? 'Generado' : 'No generado'}
    </span>
  )
}

function ContractStatusBadge({ contracts }: { contracts: any[] }) {
  if (!contracts || contracts.length === 0) {
    return <span className="inline-block rounded-lg px-2.5 py-1 text-[10px] font-black uppercase tracking-widest border bg-slate-500/10 text-slate-400 border-slate-500/20">Sin contrato</span>
  }

  const activeContract = contracts.find((c: any) => c.status === 'active')

  if (activeContract) {
    return <span className="inline-block rounded-lg px-2.5 py-1 text-[10px] font-black uppercase tracking-widest border bg-emerald-500/10 text-emerald-400 border-emerald-500/20">Activo</span>
  }

  const vencidoContract = contracts.find((c: any) => c.status === 'expired')
  if (vencidoContract) {
    return <span className="inline-block rounded-lg px-2.5 py-1 text-[10px] font-black uppercase tracking-widest border bg-red-500/10 text-red-400 border-red-500/20">Vencido</span>
  }

  return <span className="inline-block rounded-lg px-2.5 py-1 text-[10px] font-black uppercase tracking-widest border bg-slate-500/10 text-slate-400 border-slate-500/20">Otro</span>
}

export function EmployeeTableRow({ emp }: EmployeeTableRowProps) {
  const router = useRouter()
  const [isDeleting, setIsDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const b = emp.branches as any
  const jp = emp.job_positions as any
  const contracts = emp.contracts as any[]

  const handleDelete = async () => {
    const hasActiveContract = contracts?.some((c: any) => c.status === 'active')

    if (hasActiveContract) {
      setError('⚠️ No se puede eliminar.\n\nEste empleado tiene un contrato ACTIVO.\n\nDebes anular o finalizar el contrato primero.')
      return
    }

    if (!window.confirm(`¿Estás seguro de que deseas eliminar a ${emp.first_name} ${emp.last_name}? Esta acción no se puede deshacer.`)) {
      return
    }

    setIsDeleting(true)
    setError(null)

    const result = await deleteEmployee(emp.id)

    if (result?.error) {
      setError(result.error)
      setIsDeleting(false)
    } else {
      router.refresh()
    }
  }

  return (
    <>
      <tr key={emp.id} className="transition-colors hover:bg-slate-800/50 group border-b border-slate-700/50 last:border-0">
        <td className="px-6 py-4">
          <div className="flex items-center gap-3">
            {emp.photo_url ? (
              <img src={emp.photo_url} alt="" className="h-8 w-8 rounded-full object-cover border border-slate-700" />
            ) : (
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-800/80 border border-slate-700 text-[10px] font-black text-slate-400 uppercase">
                {emp.first_name?.[0] ?? ''}{emp.last_name?.[0] ?? ''}
              </div>
            )}
            <div>
              <div className="font-bold text-white">{emp.first_name} {emp.last_name}</div>
              <div className="text-xs font-medium text-slate-400">{emp.email}</div>
            </div>
          </div>
        </td>
        <td className="px-6 py-4 text-slate-400 font-medium">{jp?.name ?? '—'}</td>
        <td className="px-6 py-4 text-slate-400 font-medium">{b?.name ?? '—'}</td>
        <td className="px-6 py-4 text-center">
          <ContractStatusBadge contracts={contracts} />
        </td>
        <td className="px-6 py-4 text-center">
          <PinBadge hasPin={!!emp.employee_code} />
        </td>
        <td className="px-6 py-4 text-center">
          <StatusBadge active={emp.is_active} />
        </td>
        <td className="px-6 py-4 text-right">
          <div className="flex items-center justify-end gap-3 transition-opacity">
            <Link href={`/employees/${emp.id}`} className="text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-white transition-colors">Ver</Link>
            <Link href={`/employees/${emp.id}/edit`} className="text-[10px] font-black uppercase tracking-widest text-blue-400 hover:text-blue-300 transition-colors">Editar</Link>
            <button
              onClick={handleDelete}
              disabled={isDeleting}
              className="text-[10px] font-black uppercase tracking-widest text-red-500 hover:text-red-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              title="Eliminar empleado"
            >
              {isDeleting ? 'Eliminando...' : 'Eliminar'}
            </button>
          </div>
          {error && (
            <div className="mt-2 text-xs font-bold text-red-400 bg-red-500/10 border border-red-500/20 p-2 rounded-lg whitespace-pre-line text-left">
              {error}
            </div>
          )}
        </td>
      </tr>
    </>
  )
}
