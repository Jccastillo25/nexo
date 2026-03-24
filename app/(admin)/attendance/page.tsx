'use client'

import React, { useState } from 'react'
import { MonitorGrid } from '@/components/Monitor/MonitorGrid'
import { ActionDrawer } from '@/components/Monitor/ActionDrawer'
import { useGlobalContext } from '@/context/GlobalContext'
import { AlertCircle, Clock, Users, ArrowUpRight } from 'lucide-react'

export default function AttendanceMonitorPage() {
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
          Para ver el Monitor Operativo, por favor selecciona una empresa específica en el buscador del Dashboard.
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
            En Vivo
          </p>
          <h1 className="mt-1 text-4xl font-black tracking-tight text-slate-900">
            Monitor Operativo <span className="text-blue-600">360°</span>
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Supervisión jerárquica y gestión de asistencia en tiempo real.
          </p>
        </div>

        <div className="flex gap-3">
          <div className="flex items-center gap-2 rounded-2xl bg-white px-4 py-2 shadow-sm ring-1 ring-slate-200">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500"></span>
            </span>
            <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">Servicio Activo</span>
          </div>
        </div>
      </div>

      {/* Quick Stats Banner (Optional) */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Presentes" value="--" icon={<Users size={20} />} color="text-green-600" />
        <StatCard label="En Descanso" value="--" icon={<Clock size={20} />} color="text-amber-500" />
        <StatCard label="Incidentes Hoy" value="0" icon={<AlertCircle size={20} />} color="text-red-500" />
      </div>

      {/* Main Grid */}
      <MonitorGrid 
        companyId={companyId} 
        onOpenActionDrawer={handleOpenDrawer} 
      />

      {/* Action Drawer */}
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
    <div className="flex items-center justify-between rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200 transition-hover hover:ring-slate-300">
      <div className="space-y-1">
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{label}</p>
        <p className="text-2xl font-black text-slate-900">{value}</p>
      </div>
      <div className={`flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-50 ${color}`}>
        {icon}
      </div>
    </div>
  )
}
