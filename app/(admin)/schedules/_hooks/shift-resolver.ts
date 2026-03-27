/**
 * shift-resolver.ts
 *
 * Servicio de resolución de turnos siguiendo la jerarquía:
 * 1. Override Individual (máxima prioridad)
 * 2. Turno Global por Puesto
 * 3. Turno por Defecto de Sucursal
 * 4. Sin asignación
 */

import { SupabaseClient } from '@supabase/supabase-js'

export interface ShiftTemplate {
  id: string
  company_id: string
  name: string
  start_time: string // HH:MM (24h)
  end_time: string
  color_code: string
  is_active: boolean
}

export type ShiftSource = 'override' | 'global' | 'branch_default' | 'none'

export interface ShiftResolution {
  shiftTemplateId: string | null
  source: ShiftSource
  template: ShiftTemplate | null
}

interface ResolverCache {
  [key: string]: ShiftResolution
}

/**
 * Resuelve qué turno debe asignarse a un empleado en una fecha específica.
 * Implementa la cascada de herencia de turnos.
 */
export class ShiftResolver {
  private cache: ResolverCache = {}
  private cacheMaxAge = 5 * 60 * 1000 // 5 minutos
  private cacheTimestamps: { [key: string]: number } = {}

  constructor(private supabase: SupabaseClient) {}

  /**
   * Resuelve el turno para un empleado en una fecha específica.
   * @param employeeId UUID del empleado
   * @param scheduledDate Fecha a resolver (Date object)
   * @param companyId UUID de la compañía
   */
  async resolveShiftForDate(
    employeeId: string,
    scheduledDate: Date,
    companyId: string
  ): Promise<ShiftResolution> {
    const dateStr = scheduledDate.toISOString().split('T')[0]
    const cacheKey = `${employeeId}:${dateStr}`

    // Verificar caché
    if (this.isCacheValid(cacheKey)) {
      return this.cache[cacheKey]!
    }

    // NIVEL 1: Override Individual (máxima prioridad)
    const override = await this.checkIndividualOverride(
      employeeId,
      dateStr,
      companyId
    )
    if (override) {
      const result: ShiftResolution = {
        shiftTemplateId: override.shift_template_id,
        source: 'override',
        template: override.shift_templates && override.shift_templates.length > 0
          ? override.shift_templates[0]
          : null,
      }
      this.cacheResult(cacheKey, result)
      return result
    }

    // NIVEL 2: Turno Global por Puesto
    const global = await this.checkGlobalSchedule(
      employeeId,
      scheduledDate,
      companyId
    )
    if (global) {
      const result: ShiftResolution = {
        shiftTemplateId: global.shift_template_id,
        source: 'global',
        template: global.shift_templates && global.shift_templates.length > 0
          ? global.shift_templates[0]
          : null,
      }
      this.cacheResult(cacheKey, result)
      return result
    }

    // NIVEL 3: Turno por Defecto de Sucursal
    const branchDefault = await this.checkBranchDefault(
      employeeId,
      scheduledDate,
      companyId
    )
    if (branchDefault) {
      const result: ShiftResolution = {
        shiftTemplateId: branchDefault.shift_template_id,
        source: 'branch_default',
        template: branchDefault.shift_templates && branchDefault.shift_templates.length > 0
          ? branchDefault.shift_templates[0]
          : null,
      }
      this.cacheResult(cacheKey, result)
      return result
    }

    // NIVEL 4: Sin asignación
    const result: ShiftResolution = {
      shiftTemplateId: null,
      source: 'none',
      template: null,
    }
    this.cacheResult(cacheKey, result)
    return result
  }

  /**
   * Obtener override individual (NIVEL 1)
   */
  private async checkIndividualOverride(
    employeeId: string,
    dateStr: string,
    companyId: string
  ) {
    const { data, error } = await this.supabase
      .from('employee_shift_overrides')
      .select(`
        shift_template_id,
        shift_templates (
          id,
          company_id,
          name,
          start_time,
          end_time,
          color_code,
          is_active
        )
      `)
      .eq('employee_id', employeeId)
      .eq('scheduled_date', dateStr)
      .eq('company_id', companyId)
      .is('deleted_at', null)
      .single()

    if (error && error.code !== 'PGRST116') {
      // PGRST116 = no rows found (expected)
      console.error('Error checking individual override:', error)
    }

    return data
  }

  /**
   * Obtener turno global por puesto (NIVEL 2)
   */
  private async checkGlobalSchedule(
    employeeId: string,
    scheduledDate: Date,
    companyId: string
  ) {
    const dayOfWeek = scheduledDate.getDay()

    // Obtener puesto del empleado
    const { data: employee, error: empError } = await this.supabase
      .from('employees')
      .select('job_position_id, branch_id')
      .eq('id', employeeId)
      .single()

    if (empError || !employee?.job_position_id) {
      console.error('Error fetching employee:', empError)
      return null
    }

    // Obtener turno global
    const { data, error } = await this.supabase
      .from('global_schedules')
      .select(`
        shift_template_id,
        shift_templates (
          id,
          company_id,
          name,
          start_time,
          end_time,
          color_code,
          is_active
        )
      `)
      .eq('job_position_id', employee.job_position_id)
      .eq('day_of_week', dayOfWeek)
      .eq('company_id', companyId)
      .is('deleted_at', null)
      .single()

    if (error && error.code !== 'PGRST116') {
      console.error('Error checking global schedule:', error)
    }

    return data
  }

  /**
   * Obtener turno por defecto de sucursal (NIVEL 3)
   */
  private async checkBranchDefault(
    employeeId: string,
    scheduledDate: Date,
    companyId: string
  ) {
    const dayOfWeek = scheduledDate.getDay()

    // Obtener sucursal del empleado
    const { data: employee, error: empError } = await this.supabase
      .from('employees')
      .select('branch_id')
      .eq('id', employeeId)
      .single()

    if (empError || !employee?.branch_id) {
      console.error('Error fetching employee branch:', empError)
      return null
    }

    // Obtener turno por defecto de sucursal
    const { data, error } = await this.supabase
      .from('branch_default_shifts')
      .select(`
        shift_template_id,
        shift_templates (
          id,
          company_id,
          name,
          start_time,
          end_time,
          color_code,
          is_active
        )
      `)
      .eq('branch_id', employee.branch_id)
      .eq('day_of_week', dayOfWeek)
      .eq('company_id', companyId)
      .single()

    if (error && error.code !== 'PGRST116') {
      console.error('Error checking branch default:', error)
    }

    return data
  }

  /**
   * Valida que el caché no haya expirado
   */
  private isCacheValid(key: string): boolean {
    const timestamp = this.cacheTimestamps[key]
    if (!timestamp) return false
    return Date.now() - timestamp < this.cacheMaxAge
  }

  /**
   * Almacena un resultado en caché
   */
  private cacheResult(key: string, result: ShiftResolution): void {
    this.cache[key] = result
    this.cacheTimestamps[key] = Date.now()
  }

  /**
   * Limpia la caché completa
   */
  clearCache(): void {
    this.cache = {}
    this.cacheTimestamps = {}
  }

  /**
   * Limpia la caché de un empleado específico
   */
  clearEmployeeCache(employeeId: string): void {
    Object.keys(this.cache).forEach((key) => {
      if (key.startsWith(employeeId)) {
        delete this.cache[key]
        delete this.cacheTimestamps[key]
      }
    })
  }
}
