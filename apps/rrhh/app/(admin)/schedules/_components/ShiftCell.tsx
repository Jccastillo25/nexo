/**
 * ShiftCell.tsx
 *
 * Celda individual en la cuadrícula de planificación.
 * Soporta:
 * - Drag and drop
 * - Click para seleccionar (bulk actions)
 * - Mostrar turno asignado o vacío
 */

import { useState } from 'react'
import { X, Pencil, Pin } from 'lucide-react'
import { formatTo12h } from '@/lib/date-utils'

interface ShiftTemplate {
  id: string
  name: string
  start_time: string
  end_time: string
  color_code: string
  days_config?: any[]
}

interface ShiftCellProps {
  entityId: string
  dayOfWeek: number
  template: ShiftTemplate | null
  onDrop: (
    entityId: string,
    dayOfWeek: number,
    templateId: string | null
  ) => Promise<void>
  isDraggedOver: boolean
  draggedTemplate: string | null
  isSelected: boolean
  onSelect: (
    entityId: string,
    dayOfWeek: number,
    isSelected: boolean
  ) => void
  // Phase 2 props
  sourceLevel?: 1 | 2 | 3 | 4
  sourceName?: string
  onPin?: () => Promise<void>
  onEditTemplate?: (template: ShiftTemplate) => void
}


export default function ShiftCell({
  entityId,
  dayOfWeek,
  template,
  onDrop,
  isDraggedOver,
  draggedTemplate,
  isSelected,
  onSelect,
  sourceLevel,
  sourceName,
  onPin,
  onEditTemplate,
}: ShiftCellProps) {
  const [dragOver, setDragOver] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [showMenu, setShowMenu] = useState(false)

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setDragOver(true)
  }

  const handleDragLeave = () => {
    setDragOver(false)
  }

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setDragOver(false)
    const templateId = e.dataTransfer?.getData('shiftTemplateId')
    if (templateId) {
      setIsLoading(true)
      try {
        await onDrop(entityId, dayOfWeek, templateId)
      } finally {
        setIsLoading(false)
      }
    }
  }

  const handleRemove = async (e: React.MouseEvent) => {
    e.stopPropagation()
    setIsLoading(true)
    try {
      await onDrop(entityId, dayOfWeek, null)
    } finally {
      setIsLoading(false)
    }
  }

  const handleClick = (e: React.MouseEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault()
      onSelect(entityId, dayOfWeek, !isSelected)
    } else if (template) {
      setShowMenu(!showMenu)
    }
  }

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (template && onEditTemplate) {
      onEditTemplate(template)
      setShowMenu(false)
    }
  }

  const handlePin = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!onPin) return
    setIsLoading(true)
    try {
      await onPin()
    } finally {
      setIsLoading(false)
      setShowMenu(false)
    }
  }

  const isInherited = sourceLevel === 3 || sourceLevel === 4
  const isOverride = sourceLevel === 1

  // Resolve config for specific day
  let displayStartTime = template?.start_time
  let displayEndTime = template?.end_time
  let isRestingDay = false
  let isActiveDay = true

  if (template?.days_config) {
    const dayConfig = template.days_config.find((d: any) => d.dayOfWeek === dayOfWeek)
    if (dayConfig) {
      if (dayConfig.isSeventhDay) {
        isRestingDay = true
        isActiveDay = false
      } else if (!dayConfig.isActive) {
        isActiveDay = false
      } else {
        displayStartTime = dayConfig.startTime
        displayEndTime = dayConfig.endTime
      }
    }
  }

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={handleClick}
      className={`
        relative min-h-[44px] rounded-xl border-2 transition cursor-pointer
        ${isInherited ? 'border-dashed border-slate-300 opacity-90' : (isSelected ? 'border-slate-900 ring-2 ring-slate-900/20' : 'border-slate-200')}
        ${isSelected ? 'bg-slate-50' : 'bg-white'}
        ${dragOver && isDraggedOver ? 'border-slate-900 bg-slate-100' : ''}
        ${isLoading ? 'opacity-75 pointer-events-none' : ''}
      `}
    >
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center rounded-xl z-10">
          <div className="animate-spin h-3 w-3 border-2 border-slate-300 border-t-slate-900 rounded-full" />
        </div>
      )}

      {template ? (
        <div
          className={`h-full p-2 flex flex-col justify-center rounded-xl text-white font-bold relative overflow-hidden transition-all duration-300 ${isInherited ? 'border-dashed border-white/40 border-2' : ''} ${showMenu ? 'scale-[0.98]' : ''} ${isRestingDay ? 'bg-amber-500' : (!isActiveDay ? 'bg-slate-400' : '')}`}
          style={{ backgroundColor: (isRestingDay || !isActiveDay) ? undefined : template.color_code }}
          onMouseEnter={() => !showMenu && setShowMenu(true)}
          onMouseLeave={() => setShowMenu(false)}
        >
          {isOverride && <div className="absolute top-1 right-1 opacity-50"><Pencil size={8} /></div>}
          
          <div className="space-y-0.5">
            <p className="text-[10px] font-black truncate leading-tight uppercase tracking-tight">{template.name}</p>
            {isRestingDay ? (
              <p className="text-[9px] opacity-90 font-medium">Descanso</p>
            ) : !isActiveDay ? (
              <p className="text-[9px] opacity-90 font-medium">Inactivo</p>
            ) : (
              <p className="text-[9px] opacity-80 font-mono tracking-tighter">
                {formatTo12h(displayStartTime || '').replace(' ', '')} - {formatTo12h(displayEndTime || '').replace(' ', '')}
              </p>
            )}
          </div>

          {/* Popover de Acción Rápida */}
          {showMenu && (
            <div className="absolute inset-x-0 bottom-full mb-2 bg-white rounded-2xl shadow-[0_20px_40px_-12px_rgba(0,0,0,0.3)] ring-1 ring-slate-200 p-2 animate-in fade-in zoom-in-95 slide-in-from-bottom-2 duration-200 z-[110] min-w-[180px]">
              <div className="px-2 py-1 border-b border-slate-50 mb-1">
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Patrón Semanal</p>
                <p className="text-[11px] font-bold text-slate-900 truncate">{template.name}</p>
              </div>
              
              <div className="space-y-0.5">
                <button
                  onClick={handleEdit}
                  className="w-full flex items-center gap-2.5 px-3 py-1.5 rounded-xl text-left text-xs font-bold text-slate-900 hover:bg-slate-50 transition-colors"
                >
                  <Pencil size={12} />
                  Editar Patrón
                </button>
                <button
                  onClick={handleRemove}
                  className="w-full flex items-center gap-2.5 px-3 py-1.5 rounded-xl text-left text-xs font-bold text-red-600 hover:bg-red-50 transition-colors"
                >
                  <X size={12} />
                  Remover
                </button>
              </div>
              {/* Arrow */}
              <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-8 border-transparent border-t-white drop-shadow-sm" />
            </div>
          )}
        </div>
      ) : (
        <div className="h-full flex items-center justify-center text-slate-300 p-1">
          {dragOver && isDraggedOver ? (
            <p className="text-[9px] font-bold">Soltar</p>
          ) : (
            <p className="text-[8px] opacity-50 font-black uppercase tracking-tighter italic">Vacío</p>
          )}
        </div>
      )}
    </div>
  )
}
