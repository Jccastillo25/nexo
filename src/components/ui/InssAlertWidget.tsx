'use client'

import { useState, useEffect } from 'react'
import { FileWarning } from 'lucide-react'
import { fetchPendingInss, type PendingInssEmployee } from '@/app/actions/compliance'
import Link from 'next/link'

export function InssAlertWidget({ companyId }: { companyId: string }) {
  const [employees, setEmployees] = useState<PendingInssEmployee[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const data = await fetchPendingInss(companyId)
        setEmployees(data)
      } catch (error) {
        console.error("Error loading INSS alerts", error)
      } finally {
        setLoading(false)
      }
    }
    if (companyId) {
      load()
    }
  }, [companyId])

  if (loading) return null;
  if (employees.length === 0) return null;

  return (
    <div className="rounded-2xl border border-orange-200 bg-orange-50/50 p-5 shadow-sm mb-6 animate-in fade-in slide-in-from-top-4">
      <div className="flex items-center gap-3 mb-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-100 text-orange-600">
          <FileWarning size={20} />
        </div>
        <div>
          <h3 className="text-sm font-bold text-orange-900">Período de Gracia INSS Vencido</h3>
          <p className="text-xs text-orange-700">Completar expedientes para evitar problemas de cumplimiento legal.</p>
        </div>
      </div>
      
      <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3">
        {employees.map(emp => (
          <div key={emp.id} className="flex items-center justify-between rounded-xl bg-white p-3 border border-orange-100 shadow-sm">
            <div>
              <p className="text-sm font-bold text-slate-900">{emp.first_name} {emp.last_name}</p>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Venció: {new Date(emp.inss_grace_expiry + 'T00:00:00').toLocaleDateString()}</p>
            </div>
            <Link 
              href={`/contracts`} 
              className="px-3 py-1.5 text-xs font-bold text-orange-600 bg-orange-50 rounded-lg border border-orange-100 hover:bg-orange-100 transition"
            >
              Regularizar
            </Link>
          </div>
        ))}
      </div>
    </div>
  )
}
