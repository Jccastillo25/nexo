'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '../../../src/lib/supabase/client'
import { endEmployeeBreak } from '../../actions/jobs'
import { Clock, User, Coffee, LogOut, ChevronRight, ChevronDown, UserCheck, CheckCircle2, History } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'

type Employee = {
  id: string
  first_name: string
  last_name: string
  current_status: string // active, on_break, offline
  last_status_change: string
  job_position_id: string
  photo_url: string | null
}

type JobPosition = {
  id: string
  name: string
  level: number
  parent_id: string | null
  default_break_mins: number
}

type StatusLog = {
  id: string
  employee_id: string
  start_time: string
  end_time_scheduled: string
}

export function OperationalMonitor({
  initialEmployees,
  initialPositions,
  initialLogs,
  companies
}: {
  initialEmployees: Employee[]
  initialPositions: JobPosition[]
  initialLogs: StatusLog[]
  companies: any[]
}) {
  const [employees, setEmployees] = useState(initialEmployees)
  const [activeLogs, setActiveLogs] = useState(initialLogs)
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({})
  const [selectedForEnd, setSelectedForEnd] = useState<{ empId: string, logId: string, name: string } | null>(null)
  const supabase = createClient()

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel('monitor-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'employees' }, (payload: any) => {
        if (payload.eventType === 'UPDATE') {
          setEmployees(prev => prev.map(emp => emp.id === payload.new.id ? { ...emp, ...payload.new } : emp))
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'employee_status_logs' }, (payload: any) => {
        if (payload.eventType === 'INSERT') {
          setActiveLogs(prev => [...prev, payload.new as StatusLog])
        } else if (payload.eventType === 'UPDATE' && payload.new.end_time_actual) {
          setActiveLogs(prev => prev.filter(log => log.id !== payload.new.id))
        }
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase])

  // Build the tree structure
  const treeData = useMemo(() => {
    const buildTree = (parentId: string | null = null): any[] => {
      return initialPositions
        .filter(p => p.parent_id === parentId)
        .map(p => ({
          ...p,
          children: buildTree(p.id),
          employees: employees.filter(e => e.job_position_id === p.id)
        }))
    }
    return buildTree(null)
  }, [initialPositions, employees])

  const toggleExpand = (id: string) => {
    setExpandedNodes(prev => ({ ...prev, [id]: !prev[id] }))
  }

  return (
    <div className="grid gap-6 lg:grid-cols-4">
      {/* Sidebar: Hierarchy Tree */}
      <div className="lg:col-span-1 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200 h-fit">
        <h2 className="mb-4 text-sm font-bold uppercase tracking-widest text-slate-400">Jerarquía</h2>
        <div className="space-y-1">
          {treeData.map(node => (
            <TreeNode 
              key={node.id} 
              node={node} 
              expandedNodes={expandedNodes} 
              onToggle={toggleExpand} 
            />
          ))}
        </div>
      </div>

      {/* Main: Monitor Grid */}
      <div className="lg:col-span-3 space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {employees.map(emp => (
            <EmployeeCard 
              key={emp.id} 
              employee={emp} 
              position={initialPositions.find(p => p.id === emp.job_position_id)}
              log={activeLogs.find(l => l.employee_id === emp.id)}
              onEndBreak={(logId, name) => setSelectedForEnd({ empId: emp.id, logId, name })}
            />
          ))}
        </div>
      </div>

      {/* Break End Validation Modal */}
      {selectedForEnd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md animate-in zoom-in-95 rounded-3xl bg-white p-8 shadow-2xl">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 text-amber-600">
              <Coffee className="h-8 w-8" />
            </div>
            <h3 className="text-center text-xl font-bold text-slate-900">Validar Retorno de {selectedForEnd.name}</h3>
            <p className="mt-2 text-center text-sm text-slate-500">
              El colaborador está regresando antes de tiempo. ¿Cómo desea registrar esta acción?
            </p>

            <div className="mt-8 space-y-3">
              <button 
                onClick={async () => {
                  await endEmployeeBreak(selectedForEnd.empId, selectedForEnd.logId, false)
                  setSelectedForEnd(null)
                }}
                className="flex w-full items-center justify-between rounded-2xl border-2 border-slate-100 p-4 transition hover:border-slate-900 hover:bg-slate-50"
              >
                <div className="text-left">
                  <p className="text-sm font-bold text-slate-900">Registrar Tiempo Real</p>
                  <p className="text-xs text-slate-500">Se guardará la duración exacta tomada.</p>
                </div>
                <History className="h-5 w-5 text-slate-400" />
              </button>

              <button 
                onClick={async () => {
                  await endEmployeeBreak(selectedForEnd.empId, selectedForEnd.logId, true)
                  setSelectedForEnd(null)
                }}
                className="flex w-full items-center justify-between rounded-2xl border-2 border-slate-100 p-4 transition hover:border-slate-900 hover:bg-slate-50"
              >
                <div className="text-left">
                  <p className="text-sm font-bold text-slate-900">Marcar como Completo</p>
                  <p className="text-xs text-slate-500">Ignorar retorno temprano (No afecta métricas).</p>
                </div>
                <CheckCircle2 className="h-5 w-5 text-green-500" />
              </button>
            </div>

            <button 
              onClick={() => setSelectedForEnd(null)}
              className="mt-6 w-full text-center text-xs font-bold uppercase tracking-widest text-slate-400 transition hover:text-slate-900"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function TreeNode({ node, expandedNodes, onToggle }: any) {
  const isExpanded = expandedNodes[node.id]
  const hasEmployees = node.employees.length > 0
  const hasChildren = node.children.length > 0

  return (
    <div className="space-y-1">
      <div 
        onClick={() => onToggle(node.id)}
        className="flex cursor-pointer items-center justify-between rounded-xl px-3 py-2 text-sm transition hover:bg-slate-50"
      >
        <div className="flex items-center gap-2">
          {hasChildren ? (
            isExpanded ? <ChevronDown className="h-4 w-4 text-slate-400" /> : <ChevronRight className="h-4 w-4 text-slate-400" />
          ) : (
            <div className="w-4" />
          )}
          <span className="font-bold text-slate-700">{node.name}</span>
        </div>
        <span className="text-[10px] font-bold text-slate-400">
          {node.employees.length}
        </span>
      </div>
      
      {isExpanded && (
        <div className="ml-4 border-l-2 border-slate-100 pl-2 space-y-1">
          {node.children.map((child: any) => (
            <TreeNode key={child.id} node={child} expandedNodes={expandedNodes} onToggle={onToggle} />
          ))}
          {node.employees.map((emp: any) => (
            <div key={emp.id} className="flex items-center gap-2 px-3 py-1 text-xs text-slate-500">
              <div className={`h-2 w-2 rounded-full ${
                emp.current_status === 'active' ? 'bg-green-500' : 
                emp.current_status === 'on_break' ? 'bg-amber-500' : 'bg-slate-300'
              }`} />
              <span className="truncate">{emp.first_name} {emp.last_name}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function EmployeeCard({ 
  employee, 
  position, 
  log,
  onEndBreak
}: { 
  employee: Employee, 
  position?: JobPosition, 
  log?: StatusLog,
  onEndBreak: (logId: string, name: string) => void
}) {
  const [now, setNow] = useState(new Date())

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  const getStatusDisplay = () => {
    switch(employee.current_status) {
      case 'active': return { label: 'Activo', color: 'bg-green-100 text-green-700', icon: <UserCheck className="h-4 w-4" /> }
      case 'on_break': return { label: 'En Descanso', color: 'bg-amber-100 text-amber-700', icon: <Coffee className="h-4 w-4" /> }
      default: return { label: 'Fuera', color: 'bg-slate-100 text-slate-500', icon: <LogOut className="h-4 w-4" /> }
    }
  }

  const status = getStatusDisplay()

  // Calculate break percentage
  let percentage = 0
  let overTime = false
  if (log && position) {
    const start = new Date(log.start_time).getTime()
    const elapsedMins = (now.getTime() - start) / 60000
    percentage = (elapsedMins / position.default_break_mins) * 100
    if (elapsedMins > position.default_break_mins) overTime = true
  }

  return (
    <div className={`group relative flex flex-col rounded-3xl border-2 p-5 transition hover:shadow-2xl ${
      overTime ? 'border-red-500 bg-red-50 shadow-red-100 animate-pulse' : 'border-slate-100 bg-white'
    }`}>
      <div className="flex items-center justify-between mb-4">
        <div className={`flex items-center gap-2 rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wider ${status.color}`}>
          {status.icon}
          {status.label}
        </div>
        {overTime && <span className="text-[10px] font-black text-red-600 uppercase animate-bounce">¡TIMEOUT!</span>}
      </div>

      <div className="flex items-center gap-4">
        <div className="h-14 w-14 overflow-hidden rounded-2xl bg-slate-100 shadow-inner">
          {employee.photo_url ? (
            <img src={employee.photo_url} alt="User" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-slate-300">
              <User className="h-8 w-8" />
            </div>
          )}
        </div>
        <div className="flex-1 overflow-hidden">
          <h3 className="truncate font-bold text-slate-900">{employee.first_name} {employee.last_name}</h3>
          <p className="truncate text-xs font-medium text-slate-500">{position?.name || 'Sin puesto'}</p>
        </div>
      </div>

      {employee.current_status === 'on_break' && log && (
        <div className="mt-6 space-y-2">
          <div className="flex items-center justify-between text-[10px] font-bold uppercase text-slate-500">
            <span>Uso de Descanso</span>
            <span className={overTime ? 'text-red-600' : ''}>{Math.round(percentage)}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-100 ring-1 ring-slate-200">
            <div 
              style={{ width: `${Math.min(percentage, 100)}%` }} 
              className={`h-full transition-all duration-1000 ${
                percentage > 100 ? 'bg-red-500' : percentage > 80 ? 'bg-amber-500' : 'bg-slate-900'
              }`} 
            />
          </div>
          <div className="flex items-center gap-2 text-xs font-bold text-slate-900">
            <Clock className="h-3 w-3" />
            <span>{formatDistanceToNow(new Date(log.start_time), { locale: es, addSuffix: false })} transcurridos</span>
          </div>

          <button 
             onClick={() => onEndBreak(log.id, `${employee.first_name} ${employee.last_name}`)}
             className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 py-2.5 text-xs font-bold text-white shadow-lg transition hover:bg-slate-800 active:scale-95"
          >
            Terminar Descanso
          </button>
        </div>
      )}

      {employee.current_status !== 'on_break' && (
        <div className="mt-6 flex flex-col justify-center gap-1 opacity-40">
           <p className="text-[10px] font-bold uppercase text-slate-400">Último cambio</p>
           <p className="text-xs font-medium text-slate-500">
             {formatDistanceToNow(new Date(employee.last_status_change), { locale: es, addSuffix: true })}
           </p>
        </div>
      )}
    </div>
  )
}
