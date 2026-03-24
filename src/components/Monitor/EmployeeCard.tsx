'use client'

import React from 'react'
import { EmployeeStatusBadge } from './EmployeeStatusBadge'
import { MoreHorizontal, User, Clock } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'

interface Props {
  employee: any
  onOpenDrawer: (employee: any) => void
}

export const EmployeeCard = ({ employee, onOpenDrawer }: Props) => {
  const lastChange = new Date(employee.last_status_change)
  
  return (
    <div className="group relative flex items-center gap-4 rounded-3xl bg-white p-4 shadow-sm ring-1 ring-slate-200 transition-all hover:shadow-md hover:ring-slate-300">
      {/* Avatar / Icon */}
      <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-slate-50 text-slate-400 ring-1 ring-slate-100">
        <User size={24} />
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h3 className="truncate text-sm font-semibold text-slate-900">
            {employee.first_name} {employee.last_name}
          </h3>
          <EmployeeStatusBadge status={employee.current_status} />
        </div>
        <p className="mt-0.5 truncate text-xs text-slate-500">
          {employee.job_positions?.name || 'Sin puesto'}
        </p>
        
        <div className="mt-2 flex items-center gap-1.5 text-[10px] text-slate-400">
          <Clock size={10} />
          <span>
            {formatDistanceToNow(lastChange, { addSuffix: true, locale: es })}
          </span>
        </div>
      </div>

      {/* Action Button */}
      <button 
        onClick={() => onOpenDrawer(employee)}
        className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-50 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
      >
        <MoreHorizontal size={18} />
      </button>
    </div>
  )
}
