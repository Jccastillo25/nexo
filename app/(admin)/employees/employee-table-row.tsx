'use client'

import Link from 'next/link'
import { useState, useTransition } from 'react'
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
  const [isPending, startTransition] = useTransition()
  const [showConfirm, setShowConfirm] = useState(false)
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

    setShowConfirm(true)
  }

  const confirmDelete = () => {
    setShowConfirm(false)
    setError(null)

    startTransition(async () => {
      const result = await deleteEmployee(emp.id)

      if (result?.error) {
        setError(result.error)
      } else {
        router.refresh()
      }
    })
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
              disabled={isPending}
              className="text-[10px] font-black uppercase tracking-widest text-red-500 hover:text-red-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              title="Eliminar empleado"
            >
              {isPending ? 'Eliminando...' : 'Eliminar'}
            </button>
          </div>
          {error && (
            <div className="mt-2 text-xs font-bold text-red-400 bg-red-500/10 border border-red-500/20 p-2 rounded-lg whitespace-pre-line text-left">
              {error}
            </div>
          )}
        </td>
      </tr>
      
      {showConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl p-6 sm:p-8 w-full max-w-sm shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100 mb-4">
              <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h3 className="text-xl font-black text-slate-900 text-center mb-2 tracking-tight">Precaución</h3>
            <p className="text-sm text-slate-500 mb-8 font-medium text-center leading-relaxed">
              ¿Estás seguro de que deseas eliminar permanentemente a <strong className="text-slate-800">{emp.first_name} {emp.last_name}</strong>?
            </p>
            <div className="flex flex-col-reverse sm:flex-row justify-center gap-3 w-full">
              <button 
                disabled={isPending} 
                onClick={() => setShowConfirm(false)} 
                className="flex-1 px-4 py-3 text-sm font-bold text-slate-600 bg-slate-100/80 hover:bg-slate-200 rounded-2xl transition-all active:scale-95"
              >
                Cancelar
              </button>
              <button 
                disabled={isPending} 
                onClick={confirmDelete} 
                className="flex-1 px-4 py-3 text-sm font-bold text-white bg-red-500 hover:bg-red-600 rounded-2xl shadow-xl shadow-red-500/20 transition-all active:scale-95 flex items-center justify-center gap-2"
              >
                Sí, eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
