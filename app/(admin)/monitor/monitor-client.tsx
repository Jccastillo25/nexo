'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '../../../src/lib/supabase/client'
import { endEmployeeBreak, startEmployeeBreak } from '../../actions/jobs'
import { Coffee, CheckCircle2, History, Play, Square } from 'lucide-react'

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

  // Build the tree structure for Employees grouped by Job Positions
  const treeData = useMemo(() => {
    const buildTree = (parentId: string | null = null): any[] => {
      // Sort positions by level
      const positionsAtLevel = initialPositions
        .filter(p => p.parent_id === parentId)
        .sort((a, b) => a.level - b.level)

      return positionsAtLevel.map(p => ({
        ...p,
        children: buildTree(p.id),
        employees: employees.filter(e => e.job_position_id === p.id)
      }))
    }
    return buildTree(null)
  }, [initialPositions, employees])

  return (
    <div className="space-y-6">
      {/* Cascading Hierarchy View */}
      <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <div className="space-y-8">
          {treeData.map(node => (
            <HierarchyNode 
              key={node.id} 
              node={node} 
              activeLogs={activeLogs}
              onEndBreak={(logId: string, name: string, empId: string) => setSelectedForEnd({ empId, logId, name })}
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
                  <p className="text-sm font-bold text-slate-900">Descanso Parcial (Tiempo Real)</p>
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
                  <p className="text-sm font-bold text-slate-900">Descanso Completo</p>
                  <p className="text-xs text-slate-500">Ignorar retorno temprano (Llenar bloque).</p>
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

function HierarchyNode({ node, activeLogs, onEndBreak }: any) {
  // Determine margin or layout based on Level
  const isGrid = node.level > 3
  
  let marginClass = 'ml-0'
  if (node.level === 2) marginClass = 'ml-5'
  else if (node.level === 3) marginClass = 'ml-10'
  else if (node.level > 3) marginClass = 'ml-15'

  return (
    <div className={`space-y-4 ${marginClass}`}>
      <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
        <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest">{node.name}</h3>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500">
          Nivel {node.level}
        </span>
      </div>

      {isGrid ? (
        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {node.employees.map((emp: any) => (
            <CompactEmployeeCard 
              key={emp.id} 
              employee={emp} 
              position={node}
              log={activeLogs.find((l: any) => l.employee_id === emp.id)}
              onEndBreak={onEndBreak}
            />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {node.employees.map((emp: any) => (
            <CompactEmployeeCard 
              key={emp.id} 
              employee={emp} 
              position={node}
              log={activeLogs.find((l: any) => l.employee_id === emp.id)}
              onEndBreak={onEndBreak}
            />
          ))}
        </div>
      )}

      {node.children && node.children.length > 0 && (
        <div className="pt-2 space-y-6">
          {node.children.map((child: any) => (
            <HierarchyNode 
              key={child.id} 
              node={child} 
              activeLogs={activeLogs}
              onEndBreak={onEndBreak}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function CompactEmployeeCard({ 
  employee, 
  position, 
  log,
  onEndBreak
}: { 
  employee: Employee, 
  position: JobPosition, 
  log?: StatusLog,
  onEndBreak: (logId: string, name: string, empId: string) => void
}) {
  const [elapsedSeconds, setElapsedSeconds] = useState(0)

  useEffect(() => {
    const timer = setInterval(() => {
      if (employee.current_status === 'on_break' && log) {
        setElapsedSeconds(Math.floor((new Date().getTime() - new Date(log.start_time).getTime()) / 1000))
      } else if (employee.current_status === 'active') {
        setElapsedSeconds(Math.floor((new Date().getTime() - new Date(employee.last_status_change).getTime()) / 1000))
      } else {
        setElapsedSeconds(0)
      }
    }, 1000)
    return () => clearInterval(timer)
  }, [employee.current_status, employee.last_status_change, log])

  const mins = Math.floor(elapsedSeconds / 60)
  const secs = elapsedSeconds % 60
  const timeString = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`

  const isBreak = employee.current_status === 'on_break'
  const isOvertime = isBreak && position && mins >= position.default_break_mins
  const isWarning = isBreak && position && mins >= (position.default_break_mins * 0.8) && !isOvertime
  const isOffline = employee.current_status !== 'active' && !isBreak

  let iconColor = 'bg-slate-300' // Offline
  if (employee.current_status === 'active') iconColor = 'bg-green-500'
  else if (isOvertime) iconColor = 'bg-red-500 animate-pulse'
  else if (isWarning) iconColor = 'bg-amber-500'
  else if (isBreak) iconColor = 'bg-blue-500'

  let timeColor = 'text-slate-400'
  if (isOvertime) timeColor = 'text-red-600 font-black'
  else if (isWarning) timeColor = 'text-amber-600 font-bold'
  else if (isBreak) timeColor = 'text-blue-600 font-bold'
  else if (employee.current_status === 'active') timeColor = 'text-green-600 font-bold'

  const handleAction = async () => {
    if (isBreak && log) {
      if (isOvertime || position.default_break_mins === 0) {
        // Direct end if over time or no set limit, no validation needed usually, but user wants validation always.
        // Actually, if they return *before* time, modal appears. Over time = no modal, just end.
        if (!isOvertime) {
          onEndBreak(log.id, `${employee.first_name} ${employee.last_name}`, employee.id)
        } else {
          await endEmployeeBreak(employee.id, log.id, false)
        }
      } else {
        // Show modal for early return
        onEndBreak(log.id, `${employee.first_name} ${employee.last_name}`, employee.id)
      }
    } else {
      // Start break
      await startEmployeeBreak(employee.id, position.default_break_mins)
    }
  }

  return (
    <div className={`flex items-center justify-between rounded-2xl border border-slate-100 p-3 shadow-sm transition-all hover:shadow-md ${isOvertime ? 'bg-red-50 border-red-200' : 'bg-white'}`}>
      
      {/* Left: Indicator, Name, Badge */}
      <div className="flex items-center gap-3 overflow-hidden">
        <div className="relative flex h-3 w-3 items-center justify-center">
          {isOvertime && <div className="absolute h-full w-full animate-ping rounded-full bg-red-400 opacity-75"></div>}
          <div className={`relative h-2.5 w-2.5 rounded-full ${iconColor}`}></div>
        </div>
        
        <div className="flex flex-col overflow-hidden">
          <span className="truncate text-sm font-bold text-slate-900 leading-tight">
            {employee.first_name} {employee.last_name}
          </span>
          <span className="truncate text-[10px] font-semibold text-slate-400">
            {position.name}
          </span>
        </div>
      </div>

      {/* Right: Timer & Action */}
      <div className="flex items-center gap-4 pl-2 shrink-0">
        {!isOffline && (
          <div className="flex flex-col items-end">
            <span className={`font-mono text-sm tracking-tighter ${timeColor}`}>
              {timeString}
            </span>
            <span className="text-[9px] font-bold uppercase text-slate-400">
              {isBreak ? 'Break' : 'Active'}
            </span>
          </div>
        )}

        <button 
          onClick={handleAction}
          disabled={isOffline}
          className={`flex h-8 w-8 items-center justify-center rounded-xl transition active:scale-95 disabled:opacity-30 ${
            isBreak 
              ? 'bg-slate-900 text-white hover:bg-slate-800' 
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
          }`}
          title={isBreak ? 'Terminar Descanso' : 'Iniciar Descanso'}
        >
          {isBreak ? <Square className="h-4 w-4 fill-current" /> : <Play className="h-4 w-4 fill-current" />}
        </button>
      </div>

    </div>
  )
}
