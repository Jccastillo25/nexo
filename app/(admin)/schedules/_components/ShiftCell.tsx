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
  positionId: string
  dayOfWeek: number
  template: ShiftTemplate | null
  onDrop: (
    positionId: string,
    dayOfWeek: number,
    templateId: string | null
  ) => Promise<void>
  isDraggedOver: boolean
  draggedTemplate: string | null
  isSelected: boolean
  onSelect: (
    positionId: string,
    dayOfWeek: number,
    isSelected: boolean
  ) => void
  // Phase 2 props
  sourceLevel?: 1 | 2 | 3 | 4
  sourceName?: string
  onPin?: () => Promise<void>
}


export default function ShiftCell({
  positionId,
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
        await onDrop(positionId, dayOfWeek, templateId)
      } finally {
        setIsLoading(false)
      }
    }
  }

  const handleRemove = async (e: React.MouseEvent) => {
    e.stopPropagation()
    setIsLoading(true)
    try {
      await onDrop(positionId, dayOfWeek, null)
    } finally {
      setIsLoading(false)
    }
  }

  const handleClick = (e: React.MouseEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault()
      onSelect(positionId, dayOfWeek, !isSelected)
    } else if (template) {
      setShowMenu(!showMenu)
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
        relative min-h-[80px] rounded-2xl border-2 transition cursor-pointer
        ${isInherited ? 'border-dashed border-slate-300 opacity-90' : (isSelected ? 'border-slate-900 ring-2 ring-slate-900/20' : 'border-slate-200')}
        ${isSelected ? 'bg-slate-50' : 'bg-white'}
        ${dragOver && isDraggedOver ? 'border-slate-900 bg-slate-100' : ''}
        ${isLoading ? 'opacity-75 pointer-events-none' : ''}
      `}
    >
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center rounded-2xl z-10">
          <div className="animate-spin h-4 w-4 border-2 border-slate-300 border-t-slate-900 rounded-full" />
        </div>
      )}

      {template ? (
        <div
          className={`h-full p-3 flex flex-col justify-between rounded-2xl text-white text-xs font-semibold relative overflow-hidden transition-all duration-300 ${isInherited ? 'border-dashed border-white/40 border-2' : ''} ${showMenu ? 'scale-[0.98]' : ''} ${isRestingDay ? 'bg-amber-500' : (!isActiveDay ? 'bg-slate-400' : '')}`}
          style={{ backgroundColor: (isRestingDay || !isActiveDay) ? undefined : template.color_code }}
          onMouseEnter={() => !showMenu && setShowMenu(true)}
          onMouseLeave={() => setShowMenu(false)}
        >
          {isOverride && (
            <div className="absolute top-1.5 right-1.5 opacity-50">
              <Pencil size={10} />
            </div>
          )}
          
          <div>
            <p className="font-bold truncate pr-3">{template.name}</p>
            {isRestingDay ? (
              <p className="text-[10px] uppercase font-black tracking-widest mt-1 bg-white/20 inline-block px-2 py-0.5 rounded-md">
                Descanso
              </p>
            ) : !isActiveDay ? (
              <p className="text-[10px] uppercase font-black tracking-widest mt-1 bg-white/20 inline-block px-2 py-0.5 rounded-md">
                Inactivo
              </p>
            ) : (
              <p className="text-[10px] opacity-90 mt-1 font-mono tracking-tight">
                {formatTo12h(displayStartTime || '')} - {formatTo12h(displayEndTime || '')}
              </p>
            )}
          </div>

          {/* Popover de Acción Rápida */}
          {showMenu && (
            <div className="absolute inset-x-0 bottom-full mb-2 bg-white rounded-2xl shadow-[0_20px_40px_-12px_rgba(0,0,0,0.2)] ring-1 ring-slate-200 p-2.5 animate-in fade-in zoom-in-95 slide-in-from-bottom-2 duration-200 z-[110] min-w-[200px]">
              <div className="px-2 py-1.5 border-b border-slate-50 mb-2">
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Acciones del Turno</p>
                <p className="text-xs font-bold text-slate-900 truncate mt-0.5">{template.name}</p>
              </div>
              
              <div className="space-y-1">
                <button
                  onClick={handleRemove}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left text-xs font-bold text-red-600 hover:bg-red-50 transition-colors"
                >
                  <X size={14} />
                  Borrar Asignación
                </button>
                <button
                  onClick={() => setShowMenu(false)}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  <Pencil size={14} />
                  Cambiar Plantilla
                </button>
              </div>

              {/* Arrow */}
              <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-8 border-transparent border-t-white drop-shadow-sm" />
            </div>
          )}

          {!showMenu && (
            <button
              onClick={handleRemove}
              className="self-end opacity-0 group-hover:opacity-100 transition p-1 hover:bg-white/20 rounded-lg"
              title="Eliminar"
            >
              <X size={14} />
            </button>
          )}
        </div>
      ) : (
        <div className="h-full flex items-center justify-center text-slate-400 text-xs p-3">
          <div className="text-center">
            {dragOver && isDraggedOver ? (
              <p className="font-semibold text-slate-600">Soltar aquí</p>
            ) : (
              <>
                <p className="text-[10px]">Arrastra un turno</p>
                <p className="text-[10px] mt-1">
                  (Ctrl+Click para bulk)
                </p>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
