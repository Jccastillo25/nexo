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
      <div className="flex flex-col items-center justify-center rounded-3xl bg-white p-20 shadow-sm ring-1 ring-slate-200">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-blue-50 text-blue-600">
          <AlertCircle size={40} />
        </div>
        <h2 className="mt-6 text-xl font-bold text-slate-900">Selecciona una empresa</h2>
        <p className="mt-2 max-w-xs text-center text-sm text-slate-500">
          Para ver el Monitor Operativo 360°, por favor selecciona una empresa específica en el Dashboard.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-8 pb-20">
      {/* Header Section */}
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-slate-400">
            Control de Operaciones
          </p>
          <h1 className="mt-1 text-4xl font-black tracking-tight text-slate-900">
            Monitor Operativo <span className="text-blue-600">360°</span>
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Supervisión omnicanal sincronizada con Kioskos y Tablets.
          </p>
        </div>

        <div className="flex gap-3">
          <div className="flex items-center gap-2 rounded-2xl bg-white px-4 py-2 shadow-sm ring-1 ring-slate-200">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500"></span>
            </span>
            <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">Servidor en Línea</span>
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
    <div className="flex items-center justify-between rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
      <div className="space-y-1">
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{label}</p>
        <p className="text-xl font-black text-slate-900">{value}</p>
      </div>
      <div className={`flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-50 ${color}`}>
        {icon}
      </div>
    </div>
  )
}
