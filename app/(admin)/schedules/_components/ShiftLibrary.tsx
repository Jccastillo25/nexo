/**
 * ShiftLibrary.tsx
 *
 * Panel lateral que muestra todas las plantillas de turnos disponibles.
 * Los usuarios pueden arrastrar turnos de aquí a las celdas del grid.
 */

import React from 'react'
import { formatTo12h } from '@/lib/date-utils'

interface ShiftTemplate {
  id: string
  name: string
  start_time: string
  end_time: string
  color_code: string
}

interface ShiftLibraryProps {
  templates: ShiftTemplate[]
  onDragStart: (templateId: string) => void
  onDragEnd: () => void
}


export default function ShiftLibrary({
  templates,
  onDragStart,
  onDragEnd,
}: ShiftLibraryProps) {
  const handleDragStart = (
    e: React.DragEvent<HTMLDivElement>,
    templateId: string
  ) => {
    e.dataTransfer.effectAllowed = 'copy'
    e.dataTransfer.setData('shiftTemplateId', templateId)
    onDragStart(templateId)
  }

  const handleDragEnd = () => {
    onDragEnd()
  }

  return (
    <div className="rounded-3xl bg-white shadow-sm ring-1 ring-slate-200 overflow-hidden sticky top-6 h-fit">
      <div className="border-b border-slate-100 px-6 py-4">
        <h2 className="text-base font-semibold text-slate-900">Librería de Turnos</h2>
        <p className="mt-1 text-xs text-slate-500">
          Arrastra turnos al grid para asignarlos
        </p>
      </div>

      <div className="px-4 py-4 space-y-3">
        {templates && templates.length > 0 ? (
          templates.map((template) => (
            <ShiftPill
              key={template.id}
              template={template}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
            />
          ))
        ) : (
          <div className="text-center py-8">
            <p className="text-sm text-slate-500 font-semibold">
              No hay plantillas de turnos
            </p>
            <p className="text-xs text-slate-400 mt-1">
              Crea una nueva plantilla en la sección de Horarios
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

interface ShiftPillProps {
  template: ShiftTemplate
  onDragStart: (e: React.DragEvent<HTMLDivElement>, templateId: string) => void
  onDragEnd: () => void
}

function ShiftPill({ template, onDragStart, onDragEnd }: ShiftPillProps) {
  const [isDragging, setIsDragging] = React.useState(false)

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>) => {
    setIsDragging(true)
    onDragStart(e, template.id)
  }

  const handleDragEnd = () => {
    setIsDragging(false)
    onDragEnd()
  }

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      className={`
        p-4 rounded-2xl text-white text-sm font-semibold cursor-grab
        transition select-none
        ${isDragging ? 'opacity-50 cursor-grabbing ring-2 ring-offset-2 ring-slate-900' : 'hover:opacity-90'}
      `}
      style={{
        backgroundColor: template.color_code,
      }}
    >
      <p className="font-bold">{template.name}</p>
      <p className="text-xs opacity-90 mt-1">
        {formatTo12h(template.start_time)} - {formatTo12h(template.end_time)}
      </p>
    </div>
  )
}
