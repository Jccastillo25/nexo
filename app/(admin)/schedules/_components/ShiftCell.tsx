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
        <div className="absolute inset-0 flex items-center justify-center rounded-2xl">
          <div className="animate-spin h-4 w-4 border-2 border-slate-300 border-t-slate-900 rounded-full" />
        </div>
      )}

      {template ? (
        <div
          className={`h-full p-3 flex flex-col justify-between rounded-2xl text-white text-xs font-semibold relative overflow-hidden transition-all duration-300 ${isInherited ? 'border-dashed border-white/40 border-2' : ''} ${showMenu ? 'scale-[0.98]' : ''}`}
          style={{ backgroundColor: template.color_code }}
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
            <p className="text-[10px] opacity-90 mt-1">
              {formatTo12h(template.start_time)} - {formatTo12h(template.end_time)}
            </p>
          </div>

          {/* Action Menu Overlay */}
          {showMenu && (
            <div className="absolute inset-0 bg-slate-900/95 p-2 flex flex-col justify-center items-center text-center animate-in fade-in zoom-in-95 duration-200 z-20">
              <p className="text-[9px] uppercase tracking-[0.2em] text-slate-400 font-black mb-1">Planificado</p>
              <p className="text-[10px] font-bold text-white mb-3 truncate w-full px-2">{sourceName || 'Global'}</p>
              
              <div className="flex gap-2">
                {isInherited && (
                  <button
                    onClick={handlePin}
                    className="flex items-center gap-1 bg-white text-slate-900 px-2.5 py-1.5 rounded-xl text-[9px] font-black uppercase hover:bg-slate-100 transition shadow-lg"
                  >
                    <Pin size={10} /> Fijar
                  </button>
                )}
                <button
                  onClick={handleRemove}
                  className="flex items-center gap-1 bg-red-500 text-white px-2.5 py-1.5 rounded-xl text-[9px] font-black uppercase hover:bg-red-600 transition shadow-lg"
                >
                  <X size={10} /> Borrar
                </button>
              </div>
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
