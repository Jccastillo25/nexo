'use client'

import { useState, useEffect, useMemo, useTransition, useRef, createContext, useContext } from 'react'
import { createClient } from '../../../src/lib/supabase/client'

// ─── Global tick context ──────────────────────────────────────────────────────
// A single setInterval drives all break timers. Each card reads the shared
// "now" value from context instead of running its own interval.
const NowContext = createContext<number>(Date.now())

function NowProvider({ children }: { children: React.ReactNode }) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])
  return <NowContext.Provider value={now}>{children}</NowContext.Provider>
}

function useNow() {
  return useContext(NowContext)
}
// ─────────────────────────────────────────────────────────────────────────────
import { endEmployeeBreak, startEmployeeBreak } from '../../actions/jobs'
import { markEntry, markExit, registerAbsence, endAbsence } from '../../actions/attendance'
import { 
  Coffee, CheckCircle2, History, Play, Square, 
  Briefcase, Package, Banknote, Truck, Store, 
  Monitor as MonitorIcon, Clipboard, User, ShieldCheck,
  MoreVertical, LogIn, LogOut, CalendarX, AlertTriangle
} from 'lucide-react'

// Iconography Dictionary
const IconMap: any = {
  Briefcase, Package, Banknote, Truck, Store, Monitor: MonitorIcon, Clipboard, User, ShieldCheck
}

type Employee = {
  id: string
  first_name: string
  last_name: string
  current_status: string // active, on_break, offline, absent
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
  icon_name?: string | null
}

type StatusLog = {
  id: string
  employee_id: string
  start_time: string
  end_time_scheduled: string
}

type Shift = {
  id: string
  name: string
  start_time: string
  end_time: string
}

type EmployeeShift = {
  employee_id: string
  shift_id: string
  shifts: Shift
}

export function OperationalMonitor({
  initialEmployees,
  initialPositions,
  initialLogs,
  companies,
  activeShifts
}: {
  initialEmployees: Employee[]
  initialPositions: JobPosition[]
  initialLogs: StatusLog[]
  companies: any[]
  activeShifts: any[]
}) {
  const [employees, setEmployees] = useState(initialEmployees)
  const [activeLogs, setActiveLogs] = useState(initialLogs)

  // Modals state
  const [selectedForEndBreak, setSelectedForEndBreak] = useState<{ empId: string, logId: string, name: string } | null>(null)
  const [absenceModal, setAbsenceModal] = useState<{ empId: string, name: string } | null>(null)
  const [exitModal, setExitModal] = useState<{ empId: string, name: string } | null>(null)

  // Memoize supabase client so it is only created once, not on every render
  const supabase = useMemo(() => createClient(), [])

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel('monitor-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'employees' }, (payload: any) => {
        if (payload.eventType === 'UPDATE') {
          // Realtime payload.new does NOT include joined relations (e.g. job_positions).
          // Merge only the scalar fields so we don't silently drop join data.
          setEmployees(prev => prev.map(emp =>
            emp.id === payload.new.id
              ? {
                  ...emp,
                  current_status: payload.new.current_status,
                  last_status_change: payload.new.last_status_change,
                  is_active: payload.new.is_active,
                  first_name: payload.new.first_name,
                  last_name: payload.new.last_name,
                  photo_url: payload.new.photo_url,
                }
              : emp
          ))
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

  // Handlers for Absences & Exits
  const handleRegisterAbsence = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    const reason = formData.get('reason') as string
    const notes = formData.get('notes') as string
    
    if (absenceModal) {
      const res = await registerAbsence(absenceModal.empId, reason, notes)
      if (res.error) alert(res.error)
      setAbsenceModal(null)
    }
  }

  const handleRegisterExit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    const notes = formData.get('notes') as string
    
    if (exitModal) {
      const res = await markExit(exitModal.empId, true, notes)
      if (res.error) alert(res.error)
      setExitModal(null)
    }
  }

  return (
    <NowProvider>
    <div className="space-y-6">
      <div className="rounded-3xl bg-slate-50 p-6 shadow-inner ring-1 ring-slate-200">
        <div className="space-y-12 overflow-x-auto">
          <div className="min-w-[700px] min-h-[60vh] pb-12">
            {treeData.map(node => (
              <HierarchyNode 
                key={node.id} 
                node={node} 
                activeLogs={activeLogs}
                activeShifts={activeShifts}
                onEndBreak={(logId: string, name: string, empId: string) => setSelectedForEndBreak({ empId, logId, name })}
                onOpenAbsence={(empId: string, name: string) => setAbsenceModal({ empId, name })}
                onOpenExit={(empId: string, name: string) => setExitModal({ empId, name })}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Break End Validation Modal */}
      {selectedForEndBreak && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md animate-in zoom-in-95 rounded-3xl bg-white p-8 shadow-2xl">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 text-amber-600">
              <Coffee className="h-8 w-8" />
            </div>
            <h3 className="text-center text-xl font-bold text-slate-900">Validar Retorno de {selectedForEndBreak.name}</h3>
            <p className="mt-2 text-center text-sm text-slate-500">
              El colaborador está regresando antes de tiempo. ¿Cómo desea registrar esta acción?
            </p>

            <div className="mt-8 space-y-3">
              <button 
                onClick={async () => {
                  await endEmployeeBreak(selectedForEndBreak.empId, selectedForEndBreak.logId, false)
                  setSelectedForEndBreak(null)
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
                  await endEmployeeBreak(selectedForEndBreak.empId, selectedForEndBreak.logId, true)
                  setSelectedForEndBreak(null)
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
              onClick={() => setSelectedForEndBreak(null)}
              className="mt-6 w-full text-center text-xs font-bold uppercase tracking-widest text-slate-400 transition hover:text-slate-900"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Absence Modal */}
      {absenceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
          <form onSubmit={handleRegisterAbsence} className="w-full max-w-md animate-in zoom-in-95 rounded-3xl bg-white p-8 shadow-2xl">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100 text-red-600">
              <CalendarX className="h-8 w-8" />
            </div>
            <h3 className="text-center text-xl font-bold text-slate-900">Registrar Ausencia</h3>
            <p className="mt-2 text-center text-sm text-slate-500">
              Registrando ausencia para <span className="font-bold text-slate-900">{absenceModal.name}</span>.
            </p>

            <div className="mt-6 space-y-4">
              <div>
                <label className="mb-2 block text-xs font-bold text-slate-900 uppercase">Motivo</label>
                <select name="reason" className="h-12 w-full rounded-xl border-2 border-slate-200 px-4 text-sm outline-none focus:border-slate-900">
                  <option value="sick">Enfermedad / Salud</option>
                  <option value="permission">Permiso Previo</option>
                  <option value="vacation">Vacaciones</option>
                  <option value="other">Injustificado / Otro</option>
                </select>
              </div>
              <div>
                <label className="mb-2 block text-xs font-bold text-slate-900 uppercase">Notas Adicionales</label>
                <textarea name="notes" rows={3} className="w-full rounded-xl border-2 border-slate-200 p-4 text-sm outline-none focus:border-slate-900" placeholder="Detalles de autorización o comprobantes..."></textarea>
              </div>
            </div>

            <div className="mt-8 flex gap-3">
              <button 
                type="button"
                onClick={() => setAbsenceModal(null)}
                className="flex h-12 flex-1 items-center justify-center rounded-xl font-bold text-slate-500 transition hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button 
                type="submit"
                className="flex h-12 flex-1 items-center justify-center rounded-xl bg-red-600 font-bold text-white transition hover:bg-red-700 active:scale-95"
              >
                Confirmar Ausencia
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Early Exit Modal */}
      {exitModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
          <form onSubmit={handleRegisterExit} className="w-full max-w-md animate-in zoom-in-95 rounded-3xl bg-white p-8 shadow-2xl">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-orange-100 text-orange-600">
              <LogOut className="h-8 w-8 ml-1" />
            </div>
            <h3 className="text-center text-xl font-bold text-slate-900">Salida Anticipada</h3>
            <p className="mt-2 text-center text-sm text-slate-500">
              Terminando la jornada de <span className="font-bold text-slate-900">{exitModal.name}</span> antes del horario de su turno.
            </p>

            <div className="mt-6 space-y-4">
              <div>
                <label className="mb-2 block text-xs font-bold text-slate-900 uppercase">Justificación</label>
                <textarea name="notes" rows={3} required className="w-full rounded-xl border-2 border-slate-200 p-4 text-sm outline-none focus:border-slate-900" placeholder="Razón de la salida anticipada..."></textarea>
              </div>
            </div>

            <div className="mt-8 flex gap-3">
              <button 
                type="button"
                onClick={() => setExitModal(null)}
                className="flex h-12 flex-1 items-center justify-center rounded-xl font-bold text-slate-500 transition hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button 
                type="submit"
                className="flex h-12 flex-1 items-center justify-center rounded-xl bg-slate-900 font-bold text-white transition hover:bg-slate-800 active:scale-95"
              >
                Marcar Salida
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
    </NowProvider>
  )
}

function HierarchyNode({ node, activeLogs, activeShifts, onEndBreak, onOpenAbsence, onOpenExit }: any) {
  // Only render if it has employees or children
  if (node.employees.length === 0 && node.children.length === 0) return null

  const isTopLevel = node.level === 1 || node.level === 2
  
  let paddingClass = 'pl-0'
  if (node.level === 2) paddingClass = 'pl-[20px]'
  else if (node.level === 3) paddingClass = 'pl-[40px]'
  else if (node.level > 3) paddingClass = 'pl-[60px]'

  const gridClasses = isTopLevel 
    ? "grid gap-6 grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4" 
    : node.level > 3 
      ? "grid gap-3 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4" 
      : "grid gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5"

  return (
    <div className={`space-y-4 ${paddingClass}`}>
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
            <UniversalActionCard 
              key={emp.id} 
              employee={emp} 
              position={node}
              log={activeLogs.find((l: any) => l.employee_id === emp.id)}
              empShift={activeShifts.find((s: any) => s.employee_id === emp.id)}
              onEndBreak={onEndBreak}
              onOpenAbsence={onOpenAbsence}
              onOpenExit={onOpenExit}
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
              activeShifts={activeShifts}
              onEndBreak={onEndBreak}
              onOpenAbsence={onOpenAbsence}
              onOpenExit={onOpenExit}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function UniversalActionCard({ 
  employee, 
  position, 
  log,
  empShift,
  onEndBreak,
  onOpenAbsence,
  onOpenExit,
  isLarge
}: { 
  employee: Employee, 
  position: JobPosition, 
  log?: StatusLog,
  empShift?: any,
  onEndBreak: (logId: string, name: string, empId: string) => void,
  onOpenAbsence: (empId: string, name: string) => void,
  onOpenExit: (empId: string, name: string) => void,
  isLarge: boolean
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  // Use the shared global ticker instead of a per-card setInterval
  const now = useNow()
  const elapsedSeconds =
    employee.current_status === 'on_break' && log
      ? Math.floor((now - new Date(log.start_time).getTime()) / 1000)
      : 0

  // Timer Calcs
  const maxMins = position?.default_break_mins || 60
  const maxSecs = maxMins * 60
  const mins = Math.floor(elapsedSeconds / 60)
  const secs = elapsedSeconds % 60

  const isOvertimeNum = elapsedSeconds > maxSecs
  const displayMins = isOvertimeNum ? Math.floor((elapsedSeconds - maxSecs) / 60) : mins
  const displaySecs = isOvertimeNum ? (elapsedSeconds - maxSecs) % 60 : secs
  const timeString = `${isOvertimeNum ? '+' : ''}${displayMins.toString().padStart(2, '0')}:${displaySecs.toString().padStart(2, '0')}`

  // State Booleans
  const isBreak = employee.current_status === 'on_break'
  const isAbsent = employee.current_status === 'absent'
  const isOffline = employee.current_status === 'offline' || !employee.current_status
  const isActive = employee.current_status === 'active'

  const percentage = Math.min((elapsedSeconds / maxSecs) * 100, 100)
  const isCritical = percentage >= 80 && !isOvertimeNum

  // Styling machine
  let cardBg = 'bg-white'
  let cardBorder = 'border-slate-200'
  let timerUiColor = 'text-[#4CAF50]' 
  let ringStroke = 'stroke-[#4CAF50]'

  if (isOffline) {
    cardBg = 'bg-slate-50'
    cardBorder = 'border-slate-200 border-dashed'
  } else if (isActive) {
    cardBg = 'bg-emerald-50/30'
    cardBorder = 'border-[#4CAF50] border-2 shadow-[0_4px_15px_rgba(76,175,80,0.15)]'
  } else if (isAbsent) {
    cardBg = 'bg-slate-100'
    cardBorder = 'border-slate-400 border-2'
  } else if (isBreak) {
    if (isOvertimeNum) {
      cardBg = 'bg-[#ffebee]'
      cardBorder = 'border-[#F44336] border-2 shadow-[0_0_15px_rgba(244,67,54,0.3)]'
      timerUiColor = 'text-[#F44336] animate-pulse'
      ringStroke = 'stroke-[#F44336]'
    } else if (isCritical) {
      cardBg = 'bg-[#fff3e0]'
      cardBorder = 'border-[#FF9800] border-2 shadow-[0_0_12px_rgba(255,152,0,0.2)]'
      timerUiColor = 'text-[#FF9800] animate-pulse'
      ringStroke = 'stroke-[#FF9800]'
    } else {
      cardBg = 'bg-amber-50/70'
      cardBorder = 'border-amber-400 border-2 shadow-sm'
      timerUiColor = 'text-[#4CAF50]'
      ringStroke = 'stroke-[#4CAF50]'
    }
  }

  // Formatting strings
  const lastNameInitial = employee.last_name ? ` ${employee.last_name.charAt(0)}.` : ''
  const shortName = `${employee.first_name}${lastNameInitial}`
  const initials = `${employee.first_name.charAt(0)}${employee.last_name ? employee.last_name.charAt(0) : ''}`.toUpperCase()
  const IconComponent = IconMap[position.icon_name || 'Briefcase'] || Briefcase

  const radius = isLarge ? 24 : 18
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset = isBreak ? circumference - (percentage / 100) * circumference : circumference

  // ---- Main Actions ----
  const handlePrimaryAction = async () => {
    if (isPending) return

    startTransition(async () => {
      try {
        if (isOffline) {
          if (!empShift) {
            alert('No tiene turno asignado.')
            return
          }
          const res = await markEntry(employee.id, empShift.shift_id)
          if (res.error) alert(res.error)
        } else if (isActive) {
          // Si allowed to break, start break
          if (position.default_break_mins > 0) {
            await startEmployeeBreak(employee.id, position.default_break_mins)
          } else {
            // Valid exit (on-time or early validation not required here as main action, but to keep UI simple)
            const res = await markExit(employee.id, false, 'Salida Regular')
            if (res.error) alert(res.error)
          }
        } else if (isBreak && log) {
          if (isOvertimeNum || position.default_break_mins === 0) {
            await endEmployeeBreak(employee.id, log.id, false) // Or direct to modal depending on spec, using modal for now
          } else {
            onEndBreak(log.id, shortName, employee.id)
          }
        } else if (isAbsent) {
          const res = await endAbsence(employee.id)
          if (res.error) alert(res.error)
        }
      } catch (err) {
        console.error(err)
      }
    })
  }

  // Calculate Primary Button Config
  const primaryBtn = {
    icon: <Play className="h-3 w-3 fill-current" />,
    text: 'Entrada',
    style: 'bg-emerald-600 text-white hover:bg-emerald-500 shadow-md shadow-emerald-600/20'
  }

  if (isActive) {
    if (position.default_break_mins > 0) {
      primaryBtn.icon = <Coffee className="h-3 w-3" />
      primaryBtn.text = 'Descanso'
      primaryBtn.style = 'bg-amber-100 text-amber-800 hover:bg-amber-200'
    } else {
      primaryBtn.icon = <LogOut className="h-3 w-3" />
      primaryBtn.text = 'Salida'
      primaryBtn.style = 'bg-slate-800 text-white hover:bg-slate-700'
    }
  } else if (isBreak) {
    primaryBtn.icon = <Square className="h-3 w-3 fill-current" />
    primaryBtn.text = 'Terminar'
    primaryBtn.style = 'bg-slate-900/10 text-slate-900 hover:bg-slate-900/20'
  } else if (isAbsent) {
    primaryBtn.icon = <AlertTriangle className="h-3 w-3" />
    primaryBtn.text = 'En Trabajo'
    primaryBtn.style = 'bg-slate-800 text-white hover:bg-slate-700'
  }

  return (
    <div className={`relative flex flex-col justify-between rounded-2xl p-4 transition-all duration-300 ${cardBg} ${cardBorder} shadow-sm ${isLarge ? 'h-40' : 'h-32'}`}>
      
      {/* 3-Dots Overlay Context Menu */}
      <div className="absolute top-2 right-2">
        <button 
          onClick={() => setMenuOpen(!menuOpen)}
          className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 opacity-60 transition hover:bg-slate-200 hover:text-slate-800 hover:opacity-100 focus:outline-none"
        >
          <MoreVertical className="h-4 w-4" />
        </button>

        {menuOpen && (
          <div className="absolute right-0 top-10 z-30 w-48 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl animate-in fade-in slide-in-from-top-2">
            
            {/* Contextual actions based on state */}
            {isOffline && (
              <button onClick={() => { setMenuOpen(false); onOpenAbsence(employee.id, shortName) }} className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-xs font-bold text-slate-700 hover:bg-slate-100">
                <CalendarX className="h-4 w-4 text-red-500" /> Registrar Ausencia
              </button>
            )}
            
            {isActive && (
              <button onClick={() => { setMenuOpen(false); onOpenExit(employee.id, shortName) }} className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-xs font-bold text-slate-700 hover:bg-red-50 hover:text-red-700">
                <LogOut className="h-4 w-4" /> Salida Anticipada
              </button>
            )}

            {isAbsent && (
              <div className="px-3 py-2 text-[10px] text-slate-400 leading-tight">
                El empleado se encuentra marcado como ausente para la jornada de hoy.
              </div>
            )}
            
            {(isBreak || (!isOffline && !isActive && !isAbsent)) && (
              <div className="px-3 py-2 text-[10px] text-slate-400">
                Sin acciones extra en este estado.
              </div>
            )}

          </div>
        )}
      </div>

      {menuOpen && <div className="fixed inset-0 z-20" onClick={() => setMenuOpen(false)} />}

      {/* Top: Avatar & Name */}
      <div className="flex items-start gap-3 w-[85%]">
        {/* Avatar */}
        <div className={`flex shrink-0 items-center justify-center rounded-full bg-slate-200 font-bold text-slate-500 shadow-inner ${isLarge ? 'h-10 w-10 text-base' : 'h-8 w-8 text-xs'}`}>
          {initials}
        </div>
        
        {/* Bio */}
        <div className="flex flex-col overflow-hidden w-full pt-0.5">
          <span className={`truncate font-black text-slate-900 leading-tight ${isLarge ? 'text-lg' : 'text-sm'}`}>
            {shortName}
          </span>
          <div className="mt-1 flex items-center gap-1.5 opacity-80 overflow-hidden">
            <IconComponent className={`shrink-0 ${isLarge ? 'h-4 w-4' : 'h-3 w-3'} text-slate-600`} />
            <span className="truncate text-[10px] font-bold uppercase text-slate-600 leading-none">ID: {employee.id.substring(0, 5).toUpperCase()} • {position.name}</span>
          </div>

          {isOffline && empShift && (
            <span className="mt-1.5 truncate text-[9px] font-mono text-slate-400">
              {empShift.shifts.start_time.substring(0,5)} - {empShift.shifts.end_time.substring(0,5)}
            </span>
          )}
        </div>
      </div>

      {/* Middle/Bottom: Graphics & Actions */}
      <div className="mt-auto flex items-end justify-between relative z-10">
        
        {/* Universal Primary Button */}
        <button 
          onClick={handlePrimaryAction}
          disabled={isPending}
          className={`relative z-10 flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-[11px] font-bold backdrop-blur-sm transition active:scale-95 disabled:opacity-50 ${primaryBtn.style}`}
        >
          {primaryBtn.icon} {isPending ? '...' : primaryBtn.text}
        </button>

        {/* Graphical Representation of Break (Only when on break) */}
        {isBreak && (
          <div className="relative flex items-center justify-center">
            {/* SVG Circle */}
            <svg className={`transform -rotate-90 ${isLarge ? 'h-[56px] w-[56px]' : 'h-[44px] w-[44px]'}`}>
              <circle cx={isLarge ? 28 : 22} cy={isLarge ? 28 : 22} r={radius} className="fill-none stroke-current opacity-10" strokeWidth={isLarge ? 4 : 3} />
              <circle cx={isLarge ? 28 : 22} cy={isLarge ? 28 : 22} r={radius} className={`fill-none transition-all duration-1000 ease-linear ${ringStroke}`} strokeWidth={isLarge ? 4 : 3} strokeDasharray={circumference} strokeDashoffset={strokeDashoffset} strokeLinecap="round" />
            </svg>
            <div className={`absolute flex flex-col items-center justify-center ${timerUiColor}`}>
              <span className={`font-black tracking-tighter ${isLarge ? 'text-sm' : 'text-[10px]'}`}>{timeString}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
