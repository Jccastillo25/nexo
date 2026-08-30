/**
 * useScheduleGrid.ts
 *
 * Hook principal para gestionar el estado y persistencia de la planilla maestra.
 * Maneja:
 * - Carga de global_schedules
 * - Actualizaciones individuales con optimistic updates
 * - Bulk actions (aplicar a múltiples celdas)
 * - Sincronización con Supabase
 */

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@supabase/supabase-js'
import { updateAssignmentShift, bulkUpdateAssignmentsShift } from '../../../actions/schedules'

export interface GridCell {
  assignmentId: string
  dayOfWeek: number
  shiftTemplateId: string | null
}

export interface ScheduleGridState {
  grid: Map<string, string | null>
  isDirty: boolean
  isSyncing: boolean
  error: string | null
}

export function useScheduleGrid(
  companyId: string,
  startDate?: Date,
  endDate?: Date
) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  )
  const [state, setState] = useState<ScheduleGridState>({
    grid: new Map(),
    isDirty: false,
    isSyncing: false,
    error: null,
  })

  // Cargar datos iniciales de la planilla maestra
  useEffect(() => {
    if (!companyId) return

    loadScheduleData()
  }, [companyId])

  /**
   * Carga todos los employee_assignments para la compañía
   */
  const loadScheduleData = useCallback(async () => {
    try {
      setState((prev) => ({ ...prev, isSyncing: true, error: null }))

      const { data: assignments, error } = await supabase
        .from('employee_assignments')
        .select('id, shift_template_id')
        .eq('company_id', companyId)
        .eq('is_active', true)

      if (error) throw error

      const gridMap = new Map<string, string | null>()
      assignments?.forEach((ass) => {
        // En este nuevo modelo, cada día de la columna para esta persona 
        // muestra el mismo shift_template_id (que luego el componente visual
        // resuelve usando su days_config interno para ese día específico).
        for (let dow = 0; dow <= 6; dow++) {
          const key = `${ass.id}_${dow}`
          gridMap.set(key, ass.shift_template_id)
        }
      })

      setState((prev) => ({
        ...prev,
        grid: gridMap,
        isDirty: false,
        isSyncing: false,
      }))
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error'
      setState((prev) => ({
        ...prev,
        isSyncing: false,
        error: errorMsg,
      }))
      console.error('Error loading schedule data:', err)
    }
  }, [companyId, supabase])

  /**
   * Actualiza un turno para una persona (aplica a todos los días de su patrón)
   */
  const updateCell = useCallback(
    async (
      assignmentId: string,
      dayOfWeek: number, // Recibido por compatibilidad de UI, pero afecta a toda la fila
      shiftTemplateId: string | null
    ) => {
      // Snapshot del estado actual de toda la fila para rollback
      const oldRowValues = new Map<number, string | null>()
      for (let d = 0; d <= 6; d++) {
        oldRowValues.set(d, state.grid.get(`${assignmentId}_${d}`) || null)
      }

      // Optimistic update: Actualizar TODA la fila del empleado
      setState((prev) => {
        const newGrid = new Map(prev.grid)
        for (let d = 0; d <= 6; d++) {
          const key = `${assignmentId}_${d}`
          if (shiftTemplateId) {
            newGrid.set(key, shiftTemplateId)
          } else {
            newGrid.set(key, null)
          }
        }
        return { ...prev, grid: newGrid, isDirty: true }
      })

      try {
        const { updateAssignmentShift } = await import('../../../actions/schedules')
        const result = await updateAssignmentShift(assignmentId, shiftTemplateId)
        if (result && 'error' in result) throw new Error(result.error)
      } catch (error) {
        // Rollback de la fila completa
        setState((prev) => {
          const newGrid = new Map(prev.grid)
          for (let d = 0; d <= 6; d++) {
            const key = `${assignmentId}_${d}`
            newGrid.set(key, oldRowValues.get(d) || null)
          }
          return {
            ...prev,
            grid: newGrid,
            error: error instanceof Error ? error.message : 'Update failed',
          }
        })
      }
    },
    [state.grid, companyId]
  )


  /**
   * Aplica un turno a múltiples posiciones y días (BULK ACTION)
   */
  const applyToMultiple = useCallback(
    async (
      positionIds: string[],
      daysOfWeek: number[],
      shiftTemplateId: string | null
    ) => {
      // Snapshot for rollback
      const previousGrid = new Map(state.grid)

      try {
        setState((prev) => ({ ...prev, isSyncing: true, error: null }))

        // 1. Optimistic Multi-Update
        setState((prev) => {
          const newGrid = new Map(prev.grid)
          for (const positionId of positionIds) {
            for (const dayOfWeek of daysOfWeek) {
              const key = `${positionId}_${dayOfWeek}`
              if (shiftTemplateId) {
                newGrid.set(key, shiftTemplateId)
              } else {
                newGrid.delete(key)
              }
            }
          }
          return { ...prev, grid: newGrid, isDirty: true }
        })

        // 2. Batch Server Execution
        const { bulkUpdateAssignmentsShift } = await import('../../../actions/schedules')
        const result = await bulkUpdateAssignmentsShift(positionIds, shiftTemplateId)

        if (result && 'error' in result) {
          throw new Error(result.error)
        }

        // Final sync
        await loadScheduleData()
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Error en la sincronización masiva'
        
        // ROLLBACK
        setState((prev) => ({
          ...prev,
          grid: previousGrid,
          isSyncing: false,
          error: `Sincronización Fallida: ${errorMsg}. Se restauró el estado anterior.`,
        }))
        
        console.error('Bulk sync failed, rolled back:', error)
        throw error
      }
    },
    [companyId, state.grid, loadScheduleData]
  )

  /**
   * Deshace cambios (recarga desde BD)
   */
  const revert = useCallback(() => {
    loadScheduleData()
  }, [loadScheduleData])

  /**
   * Limpia errores
   */
  const clearError = useCallback(() => {
    setState((prev) => ({ ...prev, error: null }))
  }, [])

  return {
    grid: state.grid,
    isDirty: state.isDirty,
    isSyncing: state.isSyncing,
    error: state.error,
    updateCell,
    applyToMultiple,
    revert,
    clearError,
    reload: loadScheduleData,
  }
}
