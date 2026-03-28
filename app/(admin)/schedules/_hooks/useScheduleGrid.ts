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
import { upsertGlobalSchedule } from '../../../actions/schedules'
import { upsertGlobalSchedules } from '../../../actions/assignments'

export interface GridCell {
  positionId: string
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
   * Carga todos los global_schedules para la compañía
   */
  const loadScheduleData = useCallback(async () => {
    try {
      setState((prev) => ({ ...prev, isSyncing: true, error: null }))

      const { data: schedules, error } = await supabase
        .from('global_schedules')
        .select('id, job_position_id, day_of_week, shift_template_id')
        .eq('company_id', companyId)
        .is('deleted_at', null)

      if (error) throw error

      const gridMap = new Map<string, string | null>()
      schedules?.forEach((schedule) => {
        const key = `${schedule.job_position_id}_${schedule.day_of_week}`
        gridMap.set(key, schedule.shift_template_id)
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
   * Actualiza una celda individual con optimistic update
   */
  const updateCell = useCallback(
    async (
      positionId: string,
      dayOfWeek: number,
      shiftTemplateId: string | null
    ) => {
      const key = `${positionId}_${dayOfWeek}`

      // Optimistic update (UI responde al instante)
      const oldValue = state.grid.get(key)
      setState((prev) => {
        const newGrid = new Map(prev.grid)
        if (shiftTemplateId) {
          newGrid.set(key, shiftTemplateId)
        } else {
          newGrid.delete(key)
        }
        return { ...prev, grid: newGrid, isDirty: true }
      })

      try {
        // Persistencia en background
        await persistCellChange(positionId, dayOfWeek, shiftTemplateId)
      } catch (error) {
        // Rollback si falla
        setState((prev) => {
          const newGrid = new Map(prev.grid)
          if (oldValue !== undefined) {
            newGrid.set(key, oldValue)
          } else {
            newGrid.delete(key)
          }
          return {
            ...prev,
            grid: newGrid,
            error: error instanceof Error ? error.message : 'Update failed',
          }
        })
        console.error('Error updating cell:', error)
      }
    },
    [state.grid, supabase, companyId]
  )

  /**
   * Persiste un cambio de celda usando Server Action (UPSERT o DELETE)
   */
  const persistCellChange = async (
    positionId: string,
    dayOfWeek: number,
    shiftTemplateId: string | null
  ) => {
    const result = await upsertGlobalSchedule(
      positionId,
      dayOfWeek,
      shiftTemplateId,
      companyId
    )

    if (result && 'error' in result) {
      throw new Error(result.error)
    }
  }

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
        // We process by position to keep the Server Action signature simple and performant
        for (const positionId of positionIds) {
          const result = await upsertGlobalSchedules(
            positionId,
            daysOfWeek,
            shiftTemplateId,
            companyId
          )

          if (result && 'error' in result) {
            throw new Error(`Error en el puesto ${positionId}: ${result.error}`)
          }
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
