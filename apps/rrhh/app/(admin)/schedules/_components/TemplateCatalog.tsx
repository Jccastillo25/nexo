'use client'

import React, { useState } from 'react'
import { Plus, Search, HelpCircle, Briefcase, RefreshCcw, Globe, ShieldCheck } from 'lucide-react'
import { formatTo12h } from '@/lib/date-utils'
import CreateShiftModal from './CreateShiftModal'

interface ShiftTemplate {
  id: string
  name: string
  start_time: string
  end_time: string
  color_code: string
  days_config?: any[]
  branch_id?: string | null
}

interface TemplateCatalogProps {
  companyId: string
  initialTemplates: ShiftTemplate[]
}

const CATEGORY_ICONS: Record<string, any> = {
  'Administración': <Briefcase size={20} />,
  'Rotativo': <RefreshCcw size={20} />,
  'Global': <Globe size={20} />,
  'default': <Briefcase size={20} />,
}

export default function TemplateCatalog({
  companyId,
  initialTemplates
}: TemplateCatalogProps) {
  const [templates, setTemplates] = useState<ShiftTemplate[]>(initialTemplates)
  const [searchTerm, setSearchTerm] = useState('')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedTemplate, setSelectedTemplate] = useState<ShiftTemplate | null>(null)

  const filtered = templates.filter(t => 
    t.name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const handleOpenCreate = () => {
    setSelectedTemplate(null)
    setIsModalOpen(true)
  }

  const handleOpenEdit = (template: ShiftTemplate) => {
    setSelectedTemplate(template)
    setIsModalOpen(true)
  }

  return (
    <div className="min-h-screen pb-20" style={{ color: 'var(--text-body)' }}>
      {/* Header Area */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
        <div className="space-y-1">
          <h1 className="text-4xl font-black tracking-tight" style={{ color: 'var(--text-strong)' }}>Gestión de Turnos</h1>
          <p style={{ color: 'var(--text-muted)' }} className="font-medium">Configura y asigna horarios operativos de la empresa.</p>
        </div>

        <div className="flex items-center gap-4">
          <div className="relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 transition-colors" size={20} style={{ color: 'var(--text-light)' }} />
            <input 
              type="text" 
              placeholder="Buscar turnos o patrones..."
              className="h-14 w-full md:w-80 pl-12 pr-4 rounded-2xl border-2 shadow-sm outline-none transition-all font-bold"
              style={{ 
                background: 'var(--bg-surface)', 
                borderColor: 'var(--border-soft)',
                color: 'var(--text-strong)'
              }}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <button 
            onClick={handleOpenCreate}
            className="h-14 px-8 rounded-2xl font-black flex items-center gap-3 shadow-xl transition-all whitespace-nowrap text-white hover:scale-[1.02] active:scale-[0.98]"
            style={{ 
              background: 'var(--primary)',
              boxShadow: '0 10px 15px -3px var(--primary-soft)'
            }}
          >
            <Plus size={24} strokeWidth={3} />
            Nuevo Patrón
          </button>
        </div>
      </div>

      {/* Grid of Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {filtered.map((template) => (
          <TemplateCard 
            key={template.id} 
            template={template} 
            onClick={() => handleOpenEdit(template)}
          />
        ))}

        {/* Empty/Add Card */}
        <button 
          onClick={handleOpenCreate}
          className="group relative flex flex-col items-center justify-center gap-4 h-[240px] rounded-[40px] border-4 border-dashed transition-all duration-300"
          style={{ 
            background: 'var(--primary-softer)',
            borderColor: 'var(--border-soft)'
          }}
        >
          <div 
            className="w-16 h-16 rounded-full flex items-center justify-center transition-all bg-white shadow-sm ring-1"
            style={{ 
              color: 'var(--primary)',
              boxShadow: '0 0 0 1px var(--border-soft)'
            }}
          >
            <Plus size={32} />
          </div>
          <p className="font-black transition-colors" style={{ color: 'var(--text-muted)' }}>Agregar nuevo patrón</p>
        </button>
      </div>

      <CreateShiftModal 
        companyId={companyId}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        initialData={selectedTemplate}
      />
    </div>
  )
}

function TemplateCard({ template, onClick }: { template: ShiftTemplate, onClick: () => void }) {
  // Logic to determine icon based on name
  let Icon = CATEGORY_ICONS['default']
  if (template.name.toLowerCase().includes('adm')) Icon = CATEGORY_ICONS['Administración']
  if (template.name.toLowerCase().includes('rotat')) Icon = CATEGORY_ICONS['Rotativo']
  if (template.name.toLowerCase().includes('global')) Icon = CATEGORY_ICONS['Global']

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
      onClick={onClick}
      className="group relative h-[240px] p-8 rounded-[40px] border transition-all duration-300 cursor-pointer overflow-hidden"
      style={{ 
        background: 'var(--bg-surface)', 
        borderColor: 'var(--border-soft)',
        boxShadow: 'var(--shadow-md)'
      }}
    >
      {/* Verification Badge */}
      <div className="absolute top-8 right-8" style={{ color: 'var(--primary)' }}>
        <ShieldCheck size={24} fill="white" />
        <ShieldCheck size={24} className="absolute inset-0" />
      </div>

      <div className="h-full flex flex-col justify-between">
        <div className="space-y-4">
          <div 
            className="w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-500"
            style={{ background: 'var(--bg-app)', color: 'var(--text-light)' }}
          >
            {Icon}
          </div>
          <div>
            <div className="flex items-center gap-2">
               <h3 className="text-xl font-black leading-tight" style={{ color: 'var(--text-strong)' }}>{template.name}</h3>
            </div>
            <p className="text-xs font-black uppercase tracking-widest mt-2 flex items-center gap-2" style={{ color: 'var(--text-muted)' }}>
              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: template.color_code }} />
              ESTÁNDAR
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <p className="text-sm font-bold flex items-center gap-2" style={{ color: 'var(--text-body)' }}>
            <span className="inline-block w-4 h-px" style={{ background: 'var(--border-medium)' }} />
            {displayTime}
          </p>
          
          <div className="flex gap-1.5">
            {days.map(d => {
              const config = (template.days_config || []).find((c: any) => c.dayOfWeek === d.key)
              const isActive = config ? config.isActive : (template.start_time ? true : false)
              return (
                <div 
                  key={d.key}
                  className={`
                    w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-black transition-all
                  `}
                  style={{ 
                    background: isActive ? 'var(--primary-soft)' : 'var(--bg-app)',
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
