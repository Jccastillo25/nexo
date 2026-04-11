'use client'

import React, { useState } from 'react'
import { MonitorGrid } from '@/components/Monitor/MonitorGrid'
import { ActionDrawer } from '@/components/Monitor/ActionDrawer'
import { useGlobalContext } from '@/context/GlobalContext'
import { AlertCircle, Users, Clock } from 'lucide-react'

export default function MonitorPage() {
  const { companyId, isLoading: isContextLoading } = useGlobalContext()
  const [selectedEmployee, setSelectedEmployee] = useState<any | null>(null)
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)

  const handleOpenDrawer = (employee: any) => {
    setSelectedEmployee(employee)
    setIsDrawerOpen(true)
  }

  if (isContextLoading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-blue-600" />
      </div>
    )
  }

  if (!companyId || companyId === 'all') {
    return (
      <div className="flex flex-col items-center justify-center app-surface p-20">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-blue-500/10 text-blue-500 border border-blue-500/20">
          <AlertCircle size={40} />
        </div>
        <h2 className="mt-6 text-xl font-black text-white tracking-tight">Selecciona una empresa</h2>
        <p className="mt-2 max-w-xs text-center text-sm font-medium text-slate-400">
          Para ver el Monitor Operativo 360°, por favor selecciona una empresa específica en el Dashboard.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-8 pb-20">
      {/* Header Section */}
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between px-2">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">
            Control de Operaciones
          </p>
          <h1 className="mt-1 text-4xl font-black tracking-tight text-white">
            Monitor Operativo <span className="text-blue-500">360°</span>
          </h1>
          <p className="mt-2 text-sm font-medium text-slate-400">
            Supervisión omnicanal sincronizada con Kioskos y Tablets.
          </p>
        </div>

        <div className="flex gap-3">
          <div className="flex items-center gap-2 rounded-xl bg-emerald-500/10 px-4 py-2 border border-emerald-500/20 shadow-lg shadow-emerald-500/10">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
            </span>
            <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">Servidor en Línea</span>
          </div>
        </div>
      </div>

       {/* Quick Stats Banner */}
       <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Colaboradores" value="En Vivo" icon={<Users size={20} />} color="text-blue-600" />
        <StatCard label="Actividad" value="Real-time" icon={<Clock size={20} />} color="text-emerald-500" />
        <StatCard label="Estado" value="Sync OK" icon={<AlertCircle size={20} />} color="text-amber-500" />
      </div>

      {/* Main Hierarchical Grid */}
      <MonitorGrid 
        companyId={companyId} 
        onOpenActionDrawer={handleOpenDrawer} 
      />

      {/* Control Drawer */}
      <ActionDrawer 
        employee={selectedEmployee} 
        isOpen={isDrawerOpen} 
        onClose={() => setIsDrawerOpen(false)} 
      />
    </div>
  )
}

function StatCard({ label, value, icon, color }: any) {
  return (
    <div className="flex items-center justify-between app-surface p-6">
      <div className="space-y-1">
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{label}</p>
        <p className="text-xl font-black text-white tracking-tight">{value}</p>
      </div>
      <div className={`flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-800/50 border ${color.replace('text-', 'border-').replace('600', '500/20').replace('500', '500/20')} ${color}`}>
        {icon}
      </div>
    </div>
  )
}
