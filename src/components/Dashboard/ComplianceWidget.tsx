'use client'

import { useState, useEffect } from 'react'
import { 
  PieChart, 
  Pie, 
  Cell, 
  ResponsiveContainer, 
  Tooltip 
} from 'recharts'
import { ShieldCheck, ArrowRight, AlertCircle } from 'lucide-react'
import Link from 'next/link'
import { fetchComplianceStats, type ComplianceStats } from '@/app/actions/compliance'

export function ComplianceWidget({ companyId }: { companyId: string | null }) {
  const [stats, setStats] = useState<ComplianceStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const data = await fetchComplianceStats(companyId || undefined)
        setStats(data)
      } catch (error) {
        console.error("Error loading compliance stats", error)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [companyId])

  if (loading) {
    return (
      <div className="app-surface p-6 h-[280px] flex items-center justify-center">
        <div className="animate-pulse flex flex-col items-center gap-4">
          <div className="size-20 rounded-full bg-slate-800" />
          <div className="h-4 w-32 bg-slate-800 rounded" />
        </div>
      </div>
    )
  }

  if (!stats) return null

  const expired = stats.expiredCount
  const onTime = Math.max(0, stats.totalActive - expired)
  
  const data = [
    { name: 'Al día', value: onTime, color: '#10b981' }, // emerald-500
    { name: 'Vencidos', value: expired, color: '#ef4444' } // red-500
  ]

  const hasIssues = expired > 0

  return (
    <div className="app-surface p-6 flex flex-col h-full border-l-4 border-l-indigo-500/50">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="size-8 rounded-lg bg-indigo-500/10 flex items-center justify-center border border-indigo-500/20">
            <ShieldCheck className="w-4 h-4 text-indigo-400" />
          </div>
          <h2 className="text-sm font-black text-white tracking-widest uppercase">Cumplimiento Legal</h2>
        </div>
        {hasIssues && (
          <span className="flex items-center gap-1 text-[9px] font-black text-red-400 bg-red-400/10 px-2 py-0.5 rounded-full border border-red-400/20">
            <AlertCircle className="w-2.5 h-2.5" /> RIESGO ALTO
          </span>
        )}
      </div>

      <div className="flex-1 flex items-center gap-6">
        {/* Donut Chart */}
        <div className="size-28 flex-shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={30}
                outerRadius={45}
                paddingAngle={4}
                dataKey="value"
                stroke="none"
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip 
                contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px', fontSize: '10px' }}
                itemStyle={{ color: '#fff', fontWeight: 'bold' }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Stats Summary */}
        <div className="space-y-3">
          <div>
            <p className="text-2xl font-black text-white tracking-tight leading-none">{expired}</p>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">
              Expedientes Vencidos
            </p>
          </div>
          <p className="text-xs font-medium text-slate-300 leading-tight">
            {hasIssues 
              ? `${expired} expedientes requieren regularización inmediata.`
              : 'Todos los expedientes se encuentran al día.'}
          </p>
        </div>
      </div>

      <Link 
        href="/contracts"
        className="mt-6 group flex items-center justify-between w-full py-3 px-4 bg-slate-800/50 hover:bg-slate-800 rounded-xl border border-slate-700/50 hover:border-slate-500 transition-all text-[10px] font-black text-slate-400 hover:text-white uppercase tracking-widest"
      >
        <span>Gestionar Lista</span>
        <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
      </Link>
    </div>
  )
}
