'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '../../../src/lib/supabase/client'
import { endEmployeeBreak, startEmployeeBreak } from '../../actions/jobs'
import { Coffee, CheckCircle2, History, Play, Square, Briefcase } from 'lucide-react'

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
      <div className="rounded-3xl bg-slate-50 p-6 shadow-inner ring-1 ring-slate-200">
        <div className="space-y-12">
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
  // Only render if it has employees or children
  if (node.employees.length === 0 && node.children.length === 0) return null

  // Layout sizing based on hierarchy
  const isTopLevel = node.level === 1 || node.level === 2
  const gridClasses = isTopLevel 
    ? "grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" // Larger cards for managers
    : "grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6" // Compact for operatives
  
  let marginClass = 'ml-0'
  if (node.level === 2) marginClass = 'ml-4 sm:ml-8'
  else if (node.level === 3) marginClass = 'ml-8 sm:ml-16'
  else if (node.level > 3) marginClass = 'ml-12 sm:ml-24'

  return (
    <div className={`space-y-4 ${marginClass}`}>
      <div className="flex items-center gap-3">
        <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">{node.name}</h3>
        <span className="flex h-5 items-center rounded-full bg-slate-200 px-2 text-[10px] font-bold text-slate-600">
          Lvl {node.level}
        </span>
        <div className="h-px flex-1 bg-slate-200/60" />
      </div>

      {node.employees.length > 0 && (
        <div className={gridClasses}>
          {node.employees.map((emp: any) => (
            <GraphicEmployeeCard 
              key={emp.id} 
              employee={emp} 
              position={node}
              log={activeLogs.find((l: any) => l.employee_id === emp.id)}
              onEndBreak={onEndBreak}
              isLarge={isTopLevel}
            />
          ))}
        </div>
      )}

      {node.children && node.children.length > 0 && (
        <div className="pt-4 space-y-8">
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

function GraphicEmployeeCard({ 
  employee, 
  position, 
  log,
  onEndBreak,
  isLarge
}: { 
  employee: Employee, 
  position: JobPosition, 
  log?: StatusLog,
  onEndBreak: (logId: string, name: string, empId: string) => void,
  isLarge: boolean
}) {
  const [elapsedSeconds, setElapsedSeconds] = useState(0)

  useEffect(() => {
    const timer = setInterval(() => {
      if (employee.current_status === 'on_break' && log) {
        setElapsedSeconds(Math.floor((new Date().getTime() - new Date(log.start_time).getTime()) / 1000))
      } else {
        setElapsedSeconds(0)
      }
    }, 1000)
    return () => clearInterval(timer)
  }, [employee.current_status, log])

  const maxMins = position?.default_break_mins || 60
  const maxSecs = maxMins * 60

  const mins = Math.floor(elapsedSeconds / 60)
  const secs = elapsedSeconds % 60

  // Prefix handling for over-time
  const isOvertimeNum = elapsedSeconds > maxSecs
  const displayMins = isOvertimeNum ? Math.floor((elapsedSeconds - maxSecs) / 60) : mins
  const displaySecs = isOvertimeNum ? (elapsedSeconds - maxSecs) % 60 : secs
  
  const timeString = `${isOvertimeNum ? '+' : ''}${displayMins.toString().padStart(2, '0')}:${displaySecs.toString().padStart(2, '0')}`

  const isBreak = employee.current_status === 'on_break'
  const isOffline = employee.current_status !== 'active' && !isBreak

  const percentage = Math.min((elapsedSeconds / maxSecs) * 100, 100)
  const isCritical = percentage >= 80 && !isOvertimeNum

  // Lógica Semáforo
  let cardBg = 'bg-white'
  let cardBorder = 'border-slate-200'
  let timerUiColor = 'text-blue-500'
  let ringStroke = 'stroke-blue-500'

  if (isOffline) {
    cardBg = 'bg-slate-50'
    cardBorder = 'border-slate-100' // Make offline border less visible
  } else if (employee.current_status === 'active') {
    cardBg = 'bg-white'
    cardBorder = 'border-green-400 border-2'
  } else if (isBreak) {
    if (isOvertimeNum) {
      cardBg = 'bg-red-50'
      cardBorder = 'border-red-500 border-2 shadow-[0_0_15px_rgba(239,68,68,0.2)]'
      timerUiColor = 'text-red-600 animate-pulse'
      ringStroke = 'stroke-red-500'
    } else if (isCritical) {
      cardBg = 'bg-orange-50'
      cardBorder = 'border-orange-400 border-2'
      timerUiColor = 'text-orange-600 animate-pulse'
      ringStroke = 'stroke-orange-500'
    } else {
      cardBg = 'bg-amber-50/70'
      cardBorder = 'border-amber-300 border-2'
      timerUiColor = 'text-blue-600'
      ringStroke = 'stroke-blue-500'
    }
  }

  // Format name
  const lastNameInitial = employee.last_name ? ` ${employee.last_name.charAt(0)}.` : ''
  const shortName = `${employee.first_name}${lastNameInitial}`
  const initials = `${employee.first_name.charAt(0)}${employee.last_name ? employee.last_name.charAt(0) : ''}`.toUpperCase()

  // SVG Circular progress calc
  const radius = isLarge ? 24 : 18
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset = isBreak ? circumference - (percentage / 100) * circumference : circumference

  const handleAction = async () => {
    if (isBreak && log) {
      if (isOvertimeNum || position.default_break_mins === 0) {
        if (!isOvertimeNum) {
          onEndBreak(log.id, shortName, employee.id)
        } else {
          await endEmployeeBreak(employee.id, log.id, false)
        }
      } else {
        onEndBreak(log.id, shortName, employee.id)
      }
    } else {
      await startEmployeeBreak(employee.id, position.default_break_mins)
    }
  }

  return (
    <div className={`relative flex flex-col justify-between overflow-hidden rounded-2xl p-4 transition-all duration-300 ${cardBg} ${cardBorder} shadow-sm hover:shadow-md ${isLarge ? 'h-40' : 'h-32'}`}>
      
      {/* Top: Avatar & Name */}
      <div className="flex items-start gap-3">
        {/* Avatar */}
        <div className={`flex shrink-0 items-center justify-center rounded-full bg-slate-200 font-bold text-slate-500 shadow-inner ${isLarge ? 'h-10 w-10 text-base' : 'h-8 w-8 text-xs'}`}>
          {initials}
        </div>
        
        {/* Bio & Badge */}
        <div className="flex flex-col overflow-hidden pt-0.5">
          <span className={`truncate font-black text-slate-900 leading-tight ${isLarge ? 'text-lg' : 'text-sm'}`}>
            {shortName}
          </span>
          <div className="mt-1 flex items-center gap-1 opacity-70">
            <Briefcase className="h-3 w-3 text-slate-600 shrink-0" />
            <span className="truncate text-[10px] font-bold uppercase text-slate-600 leading-none">{position.name}</span>
          </div>
        </div>
      </div>

      {/* Middle/Bottom: Graphics & Actions */}
      <div className="mt-auto flex items-end justify-between">
        
        {/* Action Button */}
        <button 
          onClick={handleAction}
          disabled={isOffline}
          className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-[11px] font-bold shadow-sm backdrop-blur-sm transition active:scale-95 disabled:opacity-30 ${
            isBreak 
              ? 'bg-slate-900/10 text-slate-900 hover:bg-slate-900/20' 
              : 'bg-slate-900 text-white hover:bg-slate-800'
          }`}
        >
          {isBreak ? (
            <>
              <Square className="h-3 w-3 fill-current" /> Terminar
            </>
          ) : (
            <>
              <Play className="h-3 w-3 fill-current" /> Descanso
            </>
          )}
        </button>

        {/* Graphical Timer */}
        {isBreak && (
          <div className="relative flex items-center justify-center">
            {/* SVG Circle */}
            <svg 
              className={`transform -rotate-90 ${isLarge ? 'h-[56px] w-[56px]' : 'h-[44px] w-[44px]'}`}
            >
              <circle
                cx={isLarge ? 28 : 22}
                cy={isLarge ? 28 : 22}
                r={radius}
                className="fill-none stroke-current opacity-10"
                strokeWidth={isLarge ? 4 : 3}
                style={{ color: 'var(--text-light)' }}
              />
              <circle
                cx={isLarge ? 28 : 22}
                cy={isLarge ? 28 : 22}
                r={radius}
                className={`fill-none transition-all duration-1000 ease-linear ${ringStroke}`}
                strokeWidth={isLarge ? 4 : 3}
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
              />
            </svg>
            
            {/* Digital Number */}
            <div className={`absolute flex flex-col items-center justify-center ${timerUiColor}`}>
              <span className={`font-black tracking-tighter ${isLarge ? 'text-sm' : 'text-[10px]'}`}>
                {timeString}
              </span>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
