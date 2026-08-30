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

  return (
    <div 
      className="rounded-[40px] border p-6 ring-1 ring-white/5 sticky top-6 h-fit max-h-[calc(100vh-120px)] flex flex-col transition-all duration-300"
      style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-soft)' }}
    >
      <div className="px-2 py-4 flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-black tracking-tight" style={{ color: 'var(--text-strong)' }}>Patrones</h2>
          <p className="mt-1 text-[11px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
            Librería Semanal
          </p>
        </div>
        <button
          onClick={onOpenCreateModal}
          className="h-12 w-12 flex items-center justify-center rounded-2xl shadow-lg transition-all group active:scale-95"
          style={{ background: 'var(--primary)', color: 'white' }}
          title="Crear nueva plantilla"
        >
          <Plus size={24} strokeWidth={3} className="transition-transform group-hover:rotate-90" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-1 pb-4 space-y-4 scrollbar-hide">
        {templates && templates.length > 0 ? (
          templates.map((template) => (
            <ShiftCard
              key={template.id}
              template={template}
              onDragStart={handleDragStart}
              onDragEnd={onDragEnd}
            />
          ))
        ) : (
          <div className="text-center py-12 px-6 rounded-[32px] border-4 border-dashed" style={{ borderColor: 'var(--border-soft)', background: 'var(--bg-app)' }}>
            <p className="text-sm font-black italic" style={{ color: 'var(--text-light)' }}>
              Lote vacío
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

interface ShiftCardProps {
  template: any
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

  const firstActive = (template.days_config || []).find((c: any) => c.isActive && !c.isSeventhDay)
  const displayTime = firstActive 
    ? `${formatTo12h(firstActive.startTime)} — ${formatTo12h(firstActive.endTime)}`
    : (template.start_time ? `${formatTo12h(template.start_time)} — ${formatTo12h(template.end_time)}` : 'Horario Variable')

  const days = [
    { label: 'L', key: 1 },
    { label: 'M', key: 2 },
    { label: 'M', key: 3 },
    { label: 'J', key: 4 },
    { label: 'V', key: 5 },
    { label: 'S', key: 6 },
    { label: 'D', key: 0 },
  ]

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      className={`
        group relative p-5 rounded-[32px] border cursor-grab transition-all duration-300
        ${isDragging ? 'opacity-50 scale-95 rotate-2 cursor-grabbing' : 'hover:-translate-y-1'}
      `}
      style={{ 
        background: 'var(--bg-app)', 
        borderColor: 'var(--border-soft)',
        boxShadow: isDragging ? 'none' : 'var(--shadow-sm)'
      }}
    >
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 overflow-hidden">
            <div className="w-2 h-2 rounded-full shrink-0" style={{ background: template.color_code }} />
            <p className="font-black truncate text-[13px] leading-tight" style={{ color: 'var(--text-strong)' }}>{template.name}</p>
          </div>
          <ChevronRight size={14} style={{ color: 'var(--text-light)' }} className="shrink-0 group-hover:translate-x-1 transition-transform" />
        </div>

        <div className="space-y-3">
          <p className="text-[11px] font-bold flex items-center gap-2" style={{ color: 'var(--text-muted)' }}>
            <span className="inline-block w-4 h-px" style={{ background: 'var(--border-medium)' }} />
            {displayTime}
          </p>
          
          <div className="flex gap-1">
            {days.map(d => {
              const config = (template.days_config || []).find((c: any) => c.dayOfWeek === d.key)
              const isActive = config ? config.isActive : (template.start_time ? true : false)
              return (
                <div 
                  key={d.key}
                  className="w-5 h-5 rounded-md flex items-center justify-center text-[8px] font-black transition-all"
                  style={{ 
                    background: isActive ? 'var(--primary-soft)' : 'var(--bg-surface)',
                    color: isActive ? 'var(--primary)' : 'var(--text-light)'
                  }}
                >
                  {d.label}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

