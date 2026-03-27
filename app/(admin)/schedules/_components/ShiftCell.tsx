/**
 * ShiftCell.tsx
 *
 * Celda individual en la cuadrícula de planificación.
 * Soporta:
 * - Drag and drop
 * - Click para seleccionar (bulk actions)
 * - Mostrar turno asignado o vacío
 */

import React, { useState } from 'react'
import { X } from 'lucide-react'

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
}

const formatTime = (time: string): string => {
  const [h, m] = time.split(':')
  const date = new Date()
  date.setHours(Number(h), Number(m))
  return new Intl.DateTimeFormat('es-NI', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
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
}: ShiftCellProps) {
  const [dragOver, setDragOver] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

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
        ${isSelected ? 'border-slate-900 bg-slate-50 ring-2 ring-slate-900/20' : 'border-slate-200 bg-white'}
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
          className="h-full p-3 flex flex-col justify-between rounded-2xl text-white text-xs font-semibold"
          style={{ backgroundColor: template.color_code }}
        >
          <div>
            <p className="font-bold">{template.name}</p>
            <p className="text-[10px] opacity-90 mt-1">
              {formatTime(template.start_time)} - {formatTime(template.end_time)}
            </p>
          </div>
          <button
            onClick={handleRemove}
            className="self-end opacity-70 hover:opacity-100 transition"
            title="Eliminar asignación"
          >
            <X size={16} />
          </button>
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
