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

    // NIVEL 1: Override Individual
    let override = await this.checkIndividualOverride(
      employeeId,
      dateStr,
      companyId
    )
    if (override?.shift_template_id) {
      const template = await this.fetchShiftTemplate(override.shift_template_id)
      const result: ShiftResolution = {
        shiftTemplateId: override.shift_template_id,
        source: 'override',
        template,
      }
      this.cacheResult(cacheKey, result)
      return result
    }

    // NIVEL 2: Turno Global por Puesto
    let global = await this.checkGlobalSchedule(
      employeeId,
      scheduledDate,
      companyId
    )
    if (global?.shift_template_id) {
      const template = await this.fetchShiftTemplate(global.shift_template_id)
      const result: ShiftResolution = {
        shiftTemplateId: global.shift_template_id,
        source: 'global',
        template,
      }
      this.cacheResult(cacheKey, result)
      return result
    }

    // NIVEL 3: Turno por Defecto de Sucursal
    let branchDefault = await this.checkBranchDefault(
      employeeId,
      scheduledDate,
      companyId
    )
    if (branchDefault?.shift_template_id) {
      const template = await this.fetchShiftTemplate(branchDefault.shift_template_id)
      const result: ShiftResolution = {
        shiftTemplateId: branchDefault.shift_template_id,
        source: 'branch_default',
        template,
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
   * Obtener template de turno por ID
   */
  private async fetchShiftTemplate(templateId: string): Promise<ShiftTemplate | null> {
    const { data } = await this.supabase
      .from('shift_templates')
      .select('id, company_id, name, start_time, end_time, color_code, is_active')
      .eq('id', templateId)
      .maybeSingle()
    return data as ShiftTemplate | null
  }

  /**
   * NIVEL 1: Verifica si hay override individual
   */
  private async checkIndividualOverride(
    employeeId: string,
    dateStr: string,
    companyId: string
  ) {
    const { data } = await this.supabase
      .from('employee_shift_overrides')
      .select('id, shift_template_id')
      .eq('company_id', companyId)
      .eq('employee_id', employeeId)
      .eq('scheduled_date', dateStr)
      .is('deleted_at', null)
      .maybeSingle()

    return data
  }

  /**
   * NIVEL 2: Buscar en global_schedules
   */
  private async checkGlobalSchedule(
    employeeId: string,
    scheduledDate: Date,
    companyId: string
  ) {
    const { data: employee } = await this.supabase
      .from('employees')
      .select('job_position_id')
      .eq('id', employeeId)
      .maybeSingle()

    if (!employee?.job_position_id) return null

    const dayOfWeek = scheduledDate.getDay()
    const { data } = await this.supabase
      .from('global_schedules')
      .select('id, shift_template_id')
      .eq('company_id', companyId)
      .eq('job_position_id', employee.job_position_id)
      .eq('day_of_week', dayOfWeek)
      .is('deleted_at', null)
      .maybeSingle()

    return data
  }

  /**
   * NIVEL 3: Buscar branch default
   */
  private async checkBranchDefault(
    employeeId: string,
    scheduledDate: Date,
    companyId: string
  ) {
    const { data: employee } = await this.supabase
      .from('employees')
      .select('branch_id')
      .eq('id', employeeId)
      .maybeSingle()

    if (!employee?.branch_id) return null

    const dayOfWeek = scheduledDate.getDay()
    const { data } = await this.supabase
      .from('branch_default_shifts')
      .select('id, shift_template_id')
      .eq('company_id', companyId)
      .eq('branch_id', employee.branch_id)
      .eq('day_of_week', dayOfWeek)
      .maybeSingle()

    return data
  }

  private isCacheValid(key: string): boolean {
    const timestamp = this.cacheTimestamps[key]
    if (!timestamp) return false
    return Date.now() - timestamp < this.cacheMaxAge
  }

  private cacheResult(key: string, result: ShiftResolution): void {
    this.cache[key] = result
    this.cacheTimestamps[key] = Date.now()
  }

  clearCache(): void {
    this.cache = {}
    this.cacheTimestamps = {}
  }

  clearEmployeeCache(employeeId: string): void {
    Object.keys(this.cache).forEach((key) => {
      if (key.startsWith(`${employeeId}:`)) {
        delete this.cache[key]
        delete this.cacheTimestamps[key]
      }
    })
  }
}
