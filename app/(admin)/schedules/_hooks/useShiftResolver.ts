/**
 * useShiftResolver.ts
 *
 * Hook que integra el ShiftResolver con React.
 * Maneja caché y resolución de turnos para empleados específicos.
 */

import { useEffect, useRef, useState, useCallback } from 'react'
import { createClient } from '@supabase/supabase-js'
import {
  ShiftResolver,
  ShiftResolution,
  ShiftTemplate,
} from './shift-resolver'

interface ResolverState {
  isLoading: boolean
  error: string | null
}

export function useShiftResolver(companyId: string) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  )
  const resolverRef = useRef<ShiftResolver | null>(null)
  const [state, setState] = useState<ResolverState>({
    isLoading: false,
    error: null,
  })

  // Inicializar resolver
  useEffect(() => {
    resolverRef.current = new ShiftResolver(supabase)
  }, [])

  /**
   * Resuelve el turno para un empleado en una fecha específica
   */
  const resolveShift = useCallback(
    async (employeeId: string, date: Date): Promise<ShiftResolution> => {
      if (!resolverRef.current) {
        throw new Error('ShiftResolver not initialized')
      }

      try {
        setState((prev) => ({ ...prev, isLoading: true, error: null }))
        const resolution = await resolverRef.current.resolveShiftForDate(
          employeeId,
          date,
          companyId
        )
        setState((prev) => ({ ...prev, isLoading: false }))
        return resolution
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error'
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: errorMsg,
        }))
        console.error('Error resolving shift:', error)
        throw error
      }
    },
    [companyId]
  )

  /**
   * Resuelve turnos para múltiples empleados en un rango de fechas
   */
  const resolveBatch = useCallback(
    async (
      employeeIds: string[],
      startDate: Date,
      endDate: Date
    ): Promise<Map<string, ShiftResolution>> => {
      if (!resolverRef.current) {
        throw new Error('ShiftResolver not initialized')
      }

      const results = new Map<string, ShiftResolution>()

      try {
        setState((prev) => ({ ...prev, isLoading: true, error: null }))

        const currentDate = new Date(startDate)
        while (currentDate <= endDate) {
          for (const employeeId of employeeIds) {
            const key = `${employeeId}:${currentDate.toISOString().split('T')[0]}`
            const resolution = await resolverRef.current.resolveShiftForDate(
              employeeId,
              currentDate,
              companyId
            )
            results.set(key, resolution)
          }
          currentDate.setDate(currentDate.getDate() + 1)
        }

        setState((prev) => ({ ...prev, isLoading: false }))
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error'
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: errorMsg,
        }))
        console.error('Error resolving batch:', error)
        throw error
      }

      return results
    },
    [companyId]
  )

  /**
   * Limpia la caché del resolver
   */
  const clearCache = useCallback(() => {
    if (resolverRef.current) {
      resolverRef.current.clearCache()
    }
  }, [])

  /**
   * Limpia la caché de un empleado específico
   */
  const clearEmployeeCache = useCallback((employeeId: string) => {
    if (resolverRef.current) {
      resolverRef.current.clearEmployeeCache(employeeId)
    }
  }, [])

  return {
    resolveShift,
    resolveBatch,
    clearCache,
    clearEmployeeCache,
    isLoading: state.isLoading,
    error: state.error,
  }
}
