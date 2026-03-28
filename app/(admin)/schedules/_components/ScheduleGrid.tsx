/**
 * ScheduleGrid.tsx
 *
 * Componente principal que renderiza la cuadrícula de planificación global.
 * Ejes:
 * - Y: Puestos de trabajo
 * - X: Días de la semana
 */

'use client'

import React, { useState } from 'react'
import { useScheduleGrid } from '../_hooks/useScheduleGrid'
import ShiftCell from './ShiftCell'
import ShiftLibrary from './ShiftLibrary'
import CreateShiftModal from './CreateShiftModal'
import { ChevronLeft, ChevronRight, AlertCircle } from 'lucide-react'

interface ScheduleGridProps {
  companyId: string
  assignments: Array<{
    id: string
    employee: {
      id: string
      first_name: string
      last_name: string
      employee_code: string
    }
    position: {
      id: string
      name: string
    }
    shift_template_id: string | null
  }>
  shiftTemplates: Array<{
    id: string
    name: string
    start_time: string
    end_time: string
    color_code: string
    days_config?: any[]
  }>
}

const DAYS_OF_WEEK = [
  { label: 'Lunes', value: 1 },
  { label: 'Martes', value: 2 },
  { label: 'Miércoles', value: 3 },
  { label: 'Jueves', value: 4 },
  { label: 'Viernes', value: 5 },
  { label: 'Sábado', value: 6 },
  { label: 'Domingo', value: 0 },
]

export default function ScheduleGrid({
  companyId,
  assignments,
  shiftTemplates,
}: ScheduleGridProps) {
  const {
    grid,
    isDirty,
    isSyncing,
    error,
    updateCell,
    applyToMultiple,
    revert,
    clearError,
  } = useScheduleGrid(companyId)

  const [draggedTemplate, setDraggedTemplate] = useState<string | null>(null)
  const [selectedCells, setSelectedCells] = useState<Set<string>>(new Set())
  const [bulkTemplateId, setBulkTemplateId] = useState<string | null>(null)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<any>(null)

  const handleDragStart = (templateId: string) => {
    setDraggedTemplate(templateId)
  }

  const handleDragEnd = () => {
    setDraggedTemplate(null)
  }

  const handleCellDrop = async (
    assignmentId: string,
    dayOfWeek: number,
    templateId: string | null
  ) => {
    await updateCell(assignmentId, dayOfWeek, templateId)
  }

  const handleCellSelect = (
    assignmentId: string,
    dayOfWeek: number,
    isSelected: boolean
  ) => {
    const key = `${assignmentId}_${dayOfWeek}`
    const newSelected = new Set(selectedCells)
    if (isSelected) {
      newSelected.add(key)
    } else {
      newSelected.delete(key)
    }
    setSelectedCells(newSelected)
  }

  const handleEditTemplate = (template: any) => {
    setEditingTemplate(template)
    setIsCreateModalOpen(true)
  }

  const handleBulkApply = async () => {
    if (!bulkTemplateId || selectedCells.size === 0) return

    const positionIds = new Set<string>()
    const daysOfWeek = new Set<number>()

    selectedCells.forEach((key) => {
      const [assId, dow] = key.split('_')
      positionIds.add(assId)
      daysOfWeek.add(Number(dow))
    })

    try {
      await applyToMultiple(
        Array.from(positionIds),
        Array.from(daysOfWeek),
        bulkTemplateId
      )
      setSelectedCells(new Set())
      setBulkTemplateId(null)
    } catch (err) {
      console.error('Error applying bulk changes:', err)
    }
  }

  const handleClearSelection = () => {
    setSelectedCells(new Set())
    setBulkTemplateId(null)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-400">
              Operación
            </p>
            <h1 className="mt-2 text-3xl font-bold text-slate-900">
              Planilla Maestra
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
              Asigna turnos globales por puesto y día de la semana. Los
              empleados heredarán estos turnos a menos que tengan un override
              individual.
            </p>
          </div>
          <div className="flex items-center gap-3">
            {isDirty && (
              <button
                onClick={() => revert()}
                disabled={isSyncing}
                className="shrink-0 rounded-2xl border border-amber-200 px-5 py-2.5 text-sm font-semibold text-amber-700 transition hover:bg-amber-50 disabled:opacity-50"
              >
                ↶ Deshacer
              </button>
            )}
            {error && (
              <button
                onClick={() => clearError()}
                className="shrink-0 rounded-2xl border border-red-200 px-5 py-2.5 text-sm font-semibold text-red-700 transition hover:bg-red-50"
              >
                Limpiar error
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="rounded-3xl border border-red-200 bg-red-50 p-4 flex gap-3">
          <AlertCircle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-red-900">{error}</p>
          </div>
        </div>
      )}

      {/* Main Grid Container */}
      <div className="grid gap-6 lg:grid-cols-5">
        {/* Shift Library (Sidebar) */}
        <div className="lg:col-span-1">
          <ShiftLibrary
            companyId={companyId}
            templates={shiftTemplates}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onOpenCreateModal={() => setIsCreateModalOpen(true)}
          />
        </div>

        {/* Schedule Grid */}
        <div className="lg:col-span-4">
          <div className="rounded-3xl bg-white shadow-sm ring-1 ring-slate-200 overflow-hidden">
            {/* Loading State */}
            {isSyncing && (
              <div className="absolute inset-0 bg-white/50 backdrop-blur-sm flex items-center justify-center rounded-3xl z-10">
                <div className="flex flex-col items-center gap-2">
                  <div className="animate-spin h-8 w-8 border-4 border-slate-200 border-t-slate-900 rounded-full" />
                  <p className="text-sm font-semibold text-slate-900">
                    Sincronizando...
                  </p>
                </div>
              </div>
            )}

            {/* Grid Header (Days of Week) */}
            <div className="border-b border-slate-100 bg-slate-50 px-6 py-2">
              <div className="grid grid-cols-[200px_repeat(7,1fr)] gap-2">
                <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                  Puesto
                </div>
                {DAYS_OF_WEEK.map((day) => (
                  <div
                    key={day.value}
                    className="text-center text-[10px] font-black uppercase tracking-wider text-slate-400"
                  >
                    {day.label}
                  </div>
                ))}
              </div>
            </div>

            {/* Grid Body (Employees × Days) */}
            <div className="overflow-x-auto">
              <div className="px-6 py-2 space-y-0.5">
                {assignments.map((ass) => (
                  <div
                    key={ass.id}
                    className="grid grid-cols-[200px_repeat(7,1fr)] gap-1.5"
                  >
                    <div className="text-[11px] font-bold text-slate-900 py-1 flex flex-col justify-center truncate pr-2 leading-tight">
                      <span className="truncate">{ass.employee.first_name} {ass.employee.last_name}</span>
                      <span className="text-[9px] font-medium text-slate-400 truncate">{ass.position.name}</span>
                    </div>
                    {DAYS_OF_WEEK.map((day) => {
                      const key = `${ass.id}_${day.value}`
                      const shiftId = grid.get(key)
                      const template = shiftTemplates.find(
                        (t) => t.id === shiftId
                      )
                      const isSelected = selectedCells.has(key)

                      return (
                        <ShiftCell
                          key={key}
                          entityId={ass.id} 
                          dayOfWeek={day.value}
                          template={template || null}
                          onDrop={handleCellDrop}
                          isDraggedOver={draggedTemplate !== null}
                          isSelected={isSelected}
                          onSelect={handleCellSelect}
                          draggedTemplate={draggedTemplate}
                          onEditTemplate={handleEditTemplate}
                        />
                      )
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Bulk Actions Panel */}
          {selectedCells.size > 0 && (
            <div className="mt-4 rounded-3xl bg-white shadow-sm ring-1 ring-slate-200 p-4 flex items-center justify-between">
              <div className="text-sm">
                <p className="font-semibold text-slate-900">
                  {selectedCells.size} celda(s) seleccionada(s)
                </p>
              </div>
              <div className="flex items-center gap-3">
                <select
                  value={bulkTemplateId || ''}
                  onChange={(e) => setBulkTemplateId(e.target.value || null)}
                  className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-900"
                >
                  <option value="">Selecciona turno...</option>
                  {shiftTemplates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
                <button
                  onClick={handleBulkApply}
                  disabled={!bulkTemplateId || isSyncing}
                  className="rounded-2xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-50"
                >
                  Aplicar
                </button>
                <button
                  onClick={handleClearSelection}
                  className="rounded-2xl border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  Limpiar
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <CreateShiftModal
        companyId={companyId}
        isOpen={isCreateModalOpen}
        onClose={() => {
          setIsCreateModalOpen(false)
          setEditingTemplate(null)
        }}
        initialData={editingTemplate}
      />
    </div>
  )
}
