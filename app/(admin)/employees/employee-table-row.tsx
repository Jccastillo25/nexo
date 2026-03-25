'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { deleteEmployee } from '@/app/actions/employees'

interface EmployeeTableRowProps {
  emp: any
}

function StatusBadge({ active }: { active: boolean }) {
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${
        active
          ? 'bg-green-100 text-green-700'
          : 'bg-slate-100 text-slate-500'
      }`}
    >
      {active ? 'Activo' : 'Inactivo'}
    </span>
  )
}

function PinBadge({ hasPin }: { hasPin: boolean }) {
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium border ${
        hasPin
          ? 'bg-blue-50 text-blue-700 border-blue-200'
          : 'bg-amber-50 text-amber-700 border-amber-200'
      }`}
    >
      {hasPin ? 'Sí' : 'No generado'}
    </span>
  )
}

function ContractStatusBadge({ contracts }: { contracts: any[] }) {
  if (!contracts || contracts.length === 0) {
    return <span className="inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold bg-slate-100 text-slate-700">Sin contrato</span>
  }

  const activeContract = contracts.find((c: any) => c.status === 'active')

  if (activeContract) {
    return <span className="inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold bg-green-100 text-green-700">🟢 Activo</span>
  }

  const vencidoContract = contracts.find((c: any) => c.status === 'expired')
  if (vencidoContract) {
    return <span className="inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold bg-red-100 text-red-700">🔴 Vencido</span>
  }

  return <span className="inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold bg-slate-100 text-slate-700">Otro</span>
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
      <tr key={emp.id} className="transition hover:bg-slate-50 group">
        <td className="px-6 py-4">
          <div className="flex items-center gap-3">
            {emp.photo_url ? (
              <img src={emp.photo_url} alt="" className="h-8 w-8 rounded-full object-cover shadow-sm ring-1 ring-slate-200" />
            ) : (
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-[10px] font-bold text-slate-500 uppercase">
                {emp.first_name?.[0] ?? ''}{emp.last_name?.[0] ?? ''}
              </div>
            )}
            <div>
              <div className="font-semibold text-slate-900">{emp.first_name} {emp.last_name}</div>
              <div className="text-xs text-slate-500">{emp.email}</div>
            </div>
          </div>
        </td>
        <td className="px-6 py-4 text-slate-600">{jp?.name ?? '—'}</td>
        <td className="px-6 py-4 text-slate-600">{b?.name ?? '—'}</td>
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
            <Link href={`/employees/${emp.id}`} className="text-xs font-semibold text-slate-600 hover:text-slate-900">Ver</Link>
            <Link href={`/employees/${emp.id}/edit`} className="text-xs font-semibold text-slate-900 hover:underline">Editar</Link>
            <button
              onClick={handleDelete}
              disabled={isDeleting}
              className="text-xs font-semibold text-red-600 hover:text-red-900 disabled:opacity-50 disabled:cursor-not-allowed"
              title="Eliminar empleado"
            >
              {isDeleting ? 'Eliminando...' : 'Eliminar'}
            </button>
          </div>
          {error && (
            <div className="mt-2 text-xs text-red-600 bg-red-50 p-2 rounded whitespace-pre-line">
              {error}
            </div>
          )}
        </td>
      </tr>
    </>
  )
}
