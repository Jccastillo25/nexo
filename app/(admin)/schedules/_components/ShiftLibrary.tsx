/**
 * ShiftLibrary.tsx
 *
 * Panel lateral que muestra todas las plantillas de turnos disponibles.
 * Los usuarios pueden arrastrar turnos de aquí a las celdas del grid.
 */

import React from 'react'
import { formatTo12h } from '@/lib/date-utils'
import { Plus, ChevronRight } from 'lucide-react'

interface ShiftTemplate {
  id: string
  name: string
  start_time: string
  end_time: string
  color_code: string
}

interface ShiftLibraryProps {
  companyId: string
  templates: ShiftTemplate[]
  onDragStart: (templateId: string) => void
  onDragEnd: () => void
  onOpenCreateModal: () => void
}


export default function ShiftLibrary({
  companyId,
  templates,
  onDragStart,
  onDragEnd,
  onOpenCreateModal,
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
    <div className="rounded-[32px] bg-slate-50 p-4 ring-1 ring-slate-200 overflow-hidden sticky top-6 h-fit max-h-[calc(100vh-100px)] flex flex-col">
      <div className="px-4 py-4 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Librería de Tarjetas</h2>
          <p className="mt-0.5 text-[11px] text-slate-500 font-medium">
            Patrones semanales de 7 días
          </p>
        </div>
        <button
          onClick={onOpenCreateModal}
          className="h-10 w-10 flex items-center justify-center rounded-2xl bg-white text-slate-900 shadow-sm ring-1 ring-slate-200 hover:bg-slate-900 hover:text-white transition-all group"
          title="Crear nueva plantilla"
        >
          <Plus size={20} className="transition-transform group-hover:rotate-90" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-2 pb-4 space-y-4 scrollbar-hide">
        {templates && templates.length > 0 ? (
          templates.map((template) => (
            <ShiftCard
              key={template.id}
              template={template}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
            />
          ))
        ) : (
          <div className="text-center py-12 px-4 rounded-3xl bg-white border-2 border-dashed border-slate-200">
            <p className="text-sm text-slate-500 font-bold">
              Matriz Vacía
            </p>
            <p className="text-[10px] text-slate-400 mt-1">
              Comienza creando un Arquitecto de Turno
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

interface ShiftCardProps {
  template: any // Using any to handle the new days_config
  onDragStart: (e: React.DragEvent<HTMLDivElement>, templateId: string) => void
  onDragEnd: () => void
}

function ShiftCard({ template, onDragStart, onDragEnd }: ShiftCardProps) {
  const [isDragging, setIsDragging] = React.useState(false)

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>) => {
    setIsDragging(true)
    onDragStart(e, template.id)
  }

  const handleDragEnd = () => {
    setIsDragging(false)
    onDragEnd()
  }

  const daysLabels = ['D', 'L', 'M', 'M', 'J', 'V', 'S']
  const daysConfig = template.days_config || []

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      className={`
        group relative p-4 rounded-3xl bg-white shadow-sm ring-1 ring-slate-200 cursor-grab
        transition-all duration-300
        ${isDragging ? 'opacity-50 scale-95 rotate-2 cursor-grabbing' : 'hover:shadow-md hover:-translate-y-1'}
      `}
    >
      <div className="flex items-center gap-3 mb-3">
        <div 
          className="h-3 w-3 rounded-full shrink-0" 
          style={{ backgroundColor: template.color_code }} 
        />
        <p className="font-bold text-slate-900 truncate text-sm">{template.name}</p>
      </div>

      {/* Mini Matrix View */}
      <div className="grid grid-cols-7 gap-1">
        {[1, 2, 3, 4, 5, 6, 0].map((d) => {
          const config = daysConfig.find((c: any) => c.dayOfWeek === d)
          const isRest = config?.isSeventhDay
          const isActive = config?.isActive
          
          return (
            <div 
              key={d}
              className={`
                h-7 flex flex-col items-center justify-center rounded-lg text-[10px] font-black
                ${isRest ? 'bg-amber-100 text-amber-700' : (isActive ? 'bg-slate-900 text-white' : 'bg-slate-50 text-slate-300')}
              `}
              title={config ? `${config.startTime || ''} - ${config.endTime || ''}` : ''}
            >
              <span>{daysLabels[d]}</span>
              {isActive && !isRest && <div className="h-0.5 w-2 bg-white/40 rounded-full mt-0.5" />}
            </div>
          )
        })}
      </div>

      <div className="mt-3 pt-3 border-t border-slate-50 flex items-center justify-between">
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">
          {daysConfig.filter((c: any) => c.isActive && !c.isSeventhDay).length} días laborales
        </p>
        <div className="h-5 w-5 rounded-lg bg-slate-50 flex items-center justify-center">
          <ChevronRight size={10} className="text-slate-400" />
        </div>
      </div>
    </div>
  )
}

