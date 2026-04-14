'use client'

import React, { useMemo, useState, useCallback, useEffect } from 'react'
import { EmployeeCard, Employee } from './EmployeeCard'
import { EmployeeStatusBadge } from './EmployeeStatusBadge'
import { useAttendanceRealtime } from '@/hooks/useAttendanceRealtime'
import { Loader2, Users, LayoutGrid, List, Network, ChevronRight } from 'lucide-react'

// ── Tipos ────────────────────────────────────────────────────────────────────

interface Position {
  id: string
  name: string
  level: number
  parent_id: string | null
}

interface PositionNode extends Position {
  employees: Employee[]
  children: PositionNode[]
}

type ViewMode = 'grid' | 'list' | 'tree'

interface Props {
  companyId: string
  onOpenActionDrawer: (employee: Employee) => void
}

// ── Paleta de avatar (igual que EmployeeCard) ─────────────────────────────────

const AVATAR_PALETTE = ['#0d7ff2','#7c3aed','#059669','#d97706','#0891b2','#be185d','#65a30d','#dc2626']

function getAvatarColor(first: string, last: string): string {
  const hash = [...`${first}${last}`].reduce((a, c) => a + c.charCodeAt(0), 0)
  return AVATAR_PALETTE[hash % AVATAR_PALETTE.length]
}

function getInitials(first: string, last: string): string {
  return (((first || '')[0] ?? '') + ((last || '')[0] ?? '')).toUpperCase() || '?'
}

// ── Helpers de tiempo ────────────────────────────────────────────────────────

function formatElapsed(isoDate: string): string {
  const ms = Math.max(0, Date.now() - new Date(isoDate).getTime())
  const s = Math.floor(ms / 1000)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  if (h > 0) return `${h}h ${m.toString().padStart(2, '0')}m`
  return `${m}m`
}

// ── Construcción del árbol de posiciones ──────────────────────────────────────

function buildPositionTree(employees: Employee[]): PositionNode[] {
  const nodeMap: Record<string, PositionNode> = {}

  // Recolectar posiciones únicas
  employees.forEach(emp => {
    const pos = emp.job_positions
    if (!pos) return
    if (!nodeMap[pos.id]) {
      nodeMap[pos.id] = { ...pos, employees: [], children: [] }
    }
    nodeMap[pos.id].employees.push(emp)
  })

  // Agrupar empleados sin posición bajo un nodo especial
  const unpositioned = employees.filter(e => !e.job_positions)
  if (unpositioned.length > 0) {
    nodeMap['__none__'] = {
      id: '__none__', name: 'Sin posición asignada', level: 99, parent_id: null,
      employees: unpositioned, children: [],
    }
  }

  // Construir árbol
  const roots: PositionNode[] = []
  Object.values(nodeMap).forEach(node => {
    if (node.parent_id && nodeMap[node.parent_id]) {
      nodeMap[node.parent_id].children.push(node)
    } else {
      roots.push(node)
    }
  })

  // Ordenar por level
  const sort = (nodes: PositionNode[]): PositionNode[] => {
    nodes.sort((a, b) => a.level - b.level)
    nodes.forEach(n => sort(n.children))
    return nodes
  }
  return sort(roots)
}

// ── Selector de vista ─────────────────────────────────────────────────────────

function ViewSelector({ view, onChange }: { view: ViewMode; onChange: (v: ViewMode) => void }) {
  const options: { key: ViewMode; label: string; Icon: React.FC<{ size: number }> }[] = [
    { key: 'grid', label: 'Grid',  Icon: LayoutGrid },
    { key: 'list', label: 'Lista', Icon: List },
    { key: 'tree', label: 'Árbol', Icon: Network },
  ]
  return (
    <div className="flex rounded-xl overflow-hidden border" style={{ borderColor: 'var(--border-soft)' }}>
      {options.map(({ key, label, Icon }) => (
        <button
          key={key}
          onClick={() => onChange(key)}
          className="flex items-center gap-1.5 px-3 py-2 text-[11px] font-black uppercase tracking-wider transition-all"
          style={{
            background: view === key ? 'var(--primary)' : 'var(--bg-surface)',
            color:      view === key ? '#ffffff'         : 'var(--text-muted)',
            boxShadow:  view === key ? '0 0 12px var(--primary-soft)' : 'none',
          }}
        >
          <Icon size={13} />
          <span className="hidden sm:inline">{label}</span>
        </button>
      ))}
    </div>
  )
}

// ── Pastillas de stats ────────────────────────────────────────────────────────

interface StatCounts { active: number; onBreak: number; absent: number; offline: number }

function StatsBar({ counts }: { counts: StatCounts }) {
  const items = [
    { label: 'Activos',  value: counts.active,  color: 'var(--success)', bg: 'rgba(16,185,129,0.1)',  border: 'rgba(16,185,129,0.25)' },
    { label: 'Descanso', value: counts.onBreak,  color: 'var(--warning)', bg: 'rgba(245,158,11,0.1)',  border: 'rgba(245,158,11,0.25)' },
    { label: 'Ausentes', value: counts.absent,   color: 'var(--danger)',  bg: 'rgba(239,68,68,0.1)',   border: 'rgba(239,68,68,0.25)'  },
    { label: 'Offline',  value: counts.offline,  color: 'var(--text-light)', bg: 'var(--bg-elevated)', border: 'var(--border-soft)'    },
  ]
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {items.map(({ label, value, color, bg, border }) => (
        <div
          key={label}
          className="flex items-center justify-between rounded-xl px-4 py-3"
          style={{ background: bg, border: `1px solid ${border}` }}
        >
          <span className="section-label">{label}</span>
          <span className="text-xl font-black tabular-nums" style={{ color }}>{value}</span>
        </div>
      ))}
    </div>
  )
}

// ── Vista Lista: fila compacta ────────────────────────────────────────────────

function ListRow({ employee, onOpen }: { employee: Employee; onOpen: (e: Employee) => void }) {
  const [elapsed, setElapsed] = useState(() => formatElapsed(employee.last_status_change))
  const isInactive = employee.current_status === 'offline' || employee.current_status === 'absent'

  useEffect(() => {
    if (isInactive) return
    const id = setInterval(() => setElapsed(formatElapsed(employee.last_status_change)), 30_000)
    return () => clearInterval(id)
  }, [employee.last_status_change, isInactive])

  const color    = getAvatarColor(employee.first_name, employee.last_name)
  const initials = getInitials(employee.first_name, employee.last_name)

  return (
    <div
      role="row"
      className="flex items-center gap-3 sm:gap-4 px-3 sm:px-4 py-2.5 rounded-xl cursor-pointer transition-all"
      style={{ border: '1px solid transparent' }}
      onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-elevated)'; e.currentTarget.style.borderColor = 'var(--border-soft)' }}
      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'transparent' }}
      onClick={() => onOpen(employee)}
    >
      {/* Avatar */}
      <div
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[11px] font-black"
        style={{ background: `${color}22`, color }}
      >
        {initials}
      </div>

      {/* Nombre */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold truncate" style={{ color: 'var(--text-strong)' }}>
          {employee.first_name} {employee.last_name}
        </p>
        <p className="text-[10px] truncate" style={{ color: 'var(--text-muted)' }}>
          {employee.job_positions?.name || 'Sin posición'}
        </p>
      </div>

      {/* Badge */}
      <div className="shrink-0">
        <EmployeeStatusBadge status={employee.current_status} />
      </div>

      {/* Tiempo */}
      <span
        className="text-[11px] font-mono font-bold w-14 text-right shrink-0 tabular-nums"
        style={{ color: isInactive ? 'var(--text-light)' : 'var(--text-muted)' }}
      >
        {isInactive ? '—' : elapsed}
      </span>

      {/* Acción */}
      <button
        className="shrink-0 rounded-lg px-2.5 py-1.5 text-[9px] font-black uppercase tracking-wider transition-colors hidden sm:block"
        style={{ background: 'var(--bg-surface)', color: 'var(--text-muted)', border: '1px solid var(--border-soft)' }}
        onMouseEnter={e => { e.currentTarget.style.background = 'var(--primary)'; e.currentTarget.style.color = '#fff' }}
        onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg-surface)'; e.currentTarget.style.color = 'var(--text-muted)' }}
        onClick={ev => { ev.stopPropagation(); onOpen(employee) }}
      >
        Acción
      </button>
    </div>
  )
}

// ── Vista Lista completa ──────────────────────────────────────────────────────

function ListView({ employees, onOpen }: { employees: Employee[]; onOpen: (e: Employee) => void }) {
  // Ordenar: activos → descanso → ausentes → offline
  const ORDER = { active: 0, on_break: 1, absent: 2, offline: 3 }
  const sorted = [...employees].sort((a, b) =>
    (ORDER[a.current_status as keyof typeof ORDER] ?? 4) -
    (ORDER[b.current_status as keyof typeof ORDER] ?? 4)
  )

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{ border: '1px solid var(--border-soft)' }}
    >
      {/* Cabecera */}
      <div
        className="hidden sm:grid px-4 py-2 text-[9px] font-black uppercase tracking-widest"
        style={{
          gridTemplateColumns: '2rem 1fr 8rem 4rem 3.5rem 5rem',
          background: 'var(--bg-elevated)',
          color: 'var(--text-light)',
          borderBottom: '1px solid var(--border-soft)',
        }}
      >
        <span />
        <span>Colaborador</span>
        <span>Estado</span>
        <span className="text-right">Tiempo</span>
        <span />
        <span />
      </div>

      {/* Filas */}
      <div className="divide-y" style={{ '--tw-divide-opacity': 1 } as React.CSSProperties}>
        {sorted.map(emp => (
          <div key={emp.id} style={{ borderColor: 'var(--border-soft)' }}>
            <ListRow employee={emp} onOpen={onOpen} />
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Vista Árbol ───────────────────────────────────────────────────────────────

function TreePositionNode({
  node,
  onOpen,
  depth = 0,
}: {
  node: PositionNode
  onOpen: (e: Employee) => void
  depth?: number
}) {
  const [expanded, setExpanded] = useState(true)
  const hasContent = node.employees.length > 0 || node.children.length > 0
  if (!hasContent) return null

  const activeCount  = node.employees.filter(e => e.current_status === 'active').length
  const breakCount   = node.employees.filter(e => e.current_status === 'on_break').length
  const absentCount  = node.employees.filter(e => e.current_status === 'absent').length

  return (
    <div className={depth > 0 ? 'pl-5 border-l' : ''} style={{ borderColor: 'var(--border-medium)' }}>
      {/* Cabecera de posición */}
      <button
        className="flex items-center gap-2 py-3 w-full text-left group"
        onClick={() => setExpanded(e => !e)}
      >
        <ChevronRight
          size={14}
          className="shrink-0 transition-transform"
          style={{
            transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)',
            color: 'var(--text-light)',
          }}
        />
        <span
          className="text-[11px] font-black uppercase tracking-[0.2em]"
          style={{ color: 'var(--text-muted)' }}
        >
          {node.name}
        </span>

        {/* Pills de estado */}
        <div className="flex items-center gap-1.5 ml-1">
          {activeCount > 0 && (
            <span className="rounded-full px-2 py-0.5 text-[9px] font-black"
              style={{ background: 'rgba(16,185,129,0.12)', color: 'var(--success)' }}>
              {activeCount} activo{activeCount > 1 ? 's' : ''}
            </span>
          )}
          {breakCount > 0 && (
            <span className="rounded-full px-2 py-0.5 text-[9px] font-black"
              style={{ background: 'rgba(245,158,11,0.12)', color: 'var(--warning)' }}>
              {breakCount} descanso
            </span>
          )}
          {absentCount > 0 && (
            <span className="rounded-full px-2 py-0.5 text-[9px] font-black"
              style={{ background: 'rgba(239,68,68,0.12)', color: 'var(--danger)' }}>
              {absentCount} ausente{absentCount > 1 ? 's' : ''}
            </span>
          )}
        </div>

        <div className="flex-1 h-px ml-2" style={{ background: 'var(--border-soft)' }} />
      </button>

      {/* Contenido expandible */}
      {expanded && (
        <div className="pb-4 space-y-4">
          {/* Empleados de esta posición */}
          {node.employees.length > 0 && (
            <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {node.employees.map(emp => (
                <EmployeeCard key={emp.id} employee={emp} onOpenDrawer={onOpen} />
              ))}
            </div>
          )}

          {/* Posiciones hijas */}
          {node.children.map(child => (
            <TreePositionNode key={child.id} node={child} onOpen={onOpen} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Vista Grid (por posición) ─────────────────────────────────────────────────

function GridView({ positionTree, employees, onOpen }: {
  positionTree: PositionNode[]
  employees: Employee[]
  onOpen: (e: Employee) => void
}) {
  // Si no hay jerarquía de posiciones, mostrar flat grid
  if (positionTree.length === 0) {
    return (
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {employees.map(emp => (
          <EmployeeCard key={emp.id} employee={emp} onOpenDrawer={onOpen} />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {positionTree.map(node => (
        <PositionSection key={node.id} node={node} onOpen={onOpen} />
      ))}
    </div>
  )
}

function PositionSection({ node, onOpen }: { node: PositionNode; onOpen: (e: Employee) => void }) {
  const hasContent = node.employees.length > 0 || node.children.length > 0
  if (!hasContent) return null

  return (
    <div className="space-y-4">
      {/* Separador de sección */}
      {(node.employees.length > 0) && (
        <>
          <div className="flex items-center gap-3">
            <div className="h-4 w-0.5 rounded-full" style={{ background: 'var(--primary)' }} />
            <span className="text-[11px] font-black uppercase tracking-[0.25em]" style={{ color: 'var(--text-muted)' }}>
              {node.name}
            </span>
            <span
              className="text-[9px] font-black rounded-full px-2 py-0.5"
              style={{ background: 'var(--primary-softer)', color: 'var(--primary)', border: '1px solid var(--primary-soft)' }}
            >
              {node.employees.length}
            </span>
            <div className="flex-1 h-px" style={{ background: 'var(--border-soft)' }} />
          </div>

          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {node.employees.map(emp => (
              <EmployeeCard key={emp.id} employee={emp} onOpenDrawer={onOpen} />
            ))}
          </div>
        </>
      )}

      {/* Recursivo para hijos */}
      {node.children.map(child => (
        <div key={child.id} className="pl-4" style={{ borderLeft: '2px solid var(--border-soft)' }}>
          <PositionSection node={child} onOpen={onOpen} />
        </div>
      ))}
    </div>
  )
}

// ── Estado vacío ──────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div
      className="flex flex-col items-center justify-center p-16 rounded-2xl"
      style={{ border: '1px solid var(--border-soft)', background: 'var(--bg-surface)' }}
    >
      <div
        className="flex h-16 w-16 items-center justify-center rounded-2xl mb-4"
        style={{ background: 'var(--bg-elevated)', color: 'var(--text-light)' }}
      >
        <Users size={28} />
      </div>
      <p className="text-sm font-bold" style={{ color: 'var(--text-muted)' }}>
        No hay empleados activos en esta empresa.
      </p>
      <p className="mt-1 text-[11px]" style={{ color: 'var(--text-light)' }}>
        Los empleados aparecerán aquí cuando registren su entrada.
      </p>
    </div>
  )
}

// ── Componente principal ──────────────────────────────────────────────────────

export const MonitorGrid = ({ companyId, onOpenActionDrawer }: Props) => {
  const { employees: rawEmployees, isLoading } = useAttendanceRealtime(companyId)
  const [view, setView] = useState<ViewMode>('grid')

  // Casteo seguro: los datos del hook coinciden con la interfaz Employee
  const employees = rawEmployees as unknown as Employee[]

  // Contadores por estado
  const counts = useMemo<StatCounts>(() => ({
    active:  employees.filter(e => e.current_status === 'active').length,
    onBreak: employees.filter(e => e.current_status === 'on_break').length,
    absent:  employees.filter(e => e.current_status === 'absent').length,
    offline: employees.filter(e => e.current_status === 'offline').length,
  }), [employees])

  // Árbol de posiciones (solo se recalcula cuando cambia la lista de empleados)
  const positionTree = useMemo(() => buildPositionTree(employees), [employees])

  // Callback estable para no re-renderizar cards innecesariamente
  const handleOpen = useCallback(
    (employee: Employee) => onOpenActionDrawer(employee),
    [onOpenActionDrawer]
  )

  if (isLoading) {
    return (
      <div
        className="flex h-64 items-center justify-center rounded-2xl"
        style={{ border: '1px solid var(--border-soft)', background: 'var(--bg-surface)' }}
      >
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: 'var(--primary)' }} />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="h-6 w-1 rounded-full" style={{ background: 'var(--primary)', boxShadow: '0 0 10px var(--primary-soft)' }} />
          <h2 className="text-sm font-black uppercase tracking-[0.3em]" style={{ color: 'var(--text-strong)' }}>
            Monitor Operativo
          </h2>
          <span
            className="text-[10px] font-black rounded-xl px-3 py-1.5 border"
            style={{
              background: 'var(--primary-softer)',
              color: 'var(--primary)',
              borderColor: 'var(--primary-soft)',
              boxShadow: '0 0 10px var(--primary-softer)',
            }}
          >
            {employees.length} EN VIVO
          </span>
        </div>

        <ViewSelector view={view} onChange={setView} />
      </div>

      {/* ── Stats ── */}
      {employees.length > 0 && <StatsBar counts={counts} />}

      {/* ── Contenido ── */}
      {employees.length === 0 ? (
        <EmptyState />
      ) : view === 'grid' ? (
        <GridView positionTree={positionTree} employees={employees} onOpen={handleOpen} />
      ) : view === 'list' ? (
        <ListView employees={employees} onOpen={handleOpen} />
      ) : (
        <div className="space-y-2">
          {positionTree.map(node => (
            <TreePositionNode key={node.id} node={node} onOpen={handleOpen} />
          ))}
        </div>
      )}
    </div>
  )
}
