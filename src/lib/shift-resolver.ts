import { SupabaseClient } from '@supabase/supabase-js'

export type ShiftSourceLevel = 1 | 2 | 3 | 4

export interface ResolvedShift {
  shift_id: string | null
  name: string
  start_time: string | null
  end_time: string | null
  color_code: string
  source_level: ShiftSourceLevel
  source_name: string
  lunch_duration: number
  late_entry_tolerance: number
  early_exit_tolerance: number
  days_config?: any[]
}

/**
 * Resolves the shift for a specific employee on a specific date using pre-fetched data.
 * This is the optimized version for large grids.
 */
export function resolveShiftInMemory(
  employee: any,
  date: Date,
  data: {
    overrides: Map<string, any> // key: empId_date
    manuals: Map<string, any>   // key: empId
    globals: Map<string, any>   // key: posId_dayOfWeek
    branches: Map<string, any>  // key: branchId_dayOfWeek
  }
): ResolvedShift | null {
  const dateISO = date.toISOString().split('T')[0]
  const dayOfWeek = date.getDay()

  const overrideKey = `${employee.id}_${dateISO}`
  const override = data.overrides.get(overrideKey)
  if (override?.shift_templates) {
    const st = override.shift_templates
    return {
      shift_id: st.id,
      name: st.name,
      start_time: st.start_time,
      end_time: st.end_time,
      color_code: st.color_code || '#64748b',
      source_level: 1,
      source_name: 'Excepción de Día',
      lunch_duration: st.lunch_duration || 0,
      late_entry_tolerance: st.late_entry_tolerance || 15,
      early_exit_tolerance: st.early_exit_tolerance || 15,
      days_config: st.days_config
    }
  }

  // LEVEL 2: MANUAL FIXED - LEGACY IGNORED OR ADAPTED
  const manual = data.manuals.get(employee.id)
  if (manual?.shifts) {
    const s = manual.shifts
    if (s.days_of_week?.includes(dayOfWeek)) {
      return {
        shift_id: s.id,
        name: s.name,
        start_time: s.start_time,
        end_time: s.end_time,
        color_code: s.color_code || '#64748b',
        source_level: 2,
        source_name: 'Asignación Fija',
        lunch_duration: s.break_minutes || 60,
        late_entry_tolerance: s.tolerance_in || 15,
        early_exit_tolerance: s.tolerance_out || 15,
        days_config: s.days_config || []
      }
    }
  }

  // LEVEL 3: GLOBAL
  if (employee.job_position_id) {
    const globalKey = `${employee.job_position_id}_${dayOfWeek}`
    const globalSched = data.globals.get(globalKey)
    if (globalSched?.shift_templates) {
      const st = globalSched.shift_templates
      return {
        shift_id: st.id,
        name: st.name,
        start_time: st.start_time,
        end_time: st.end_time,
        color_code: st.color_code || '#64748b',
        source_level: 3,
        source_name: 'Planilla Global',
        lunch_duration: st.lunch_duration || 0,
        late_entry_tolerance: st.late_entry_tolerance || 15,
        early_exit_tolerance: st.early_exit_tolerance || 15,
        days_config: st.days_config
      }
    }
  }

  // LEVEL 4: BRANCH DEFAULT
  if (employee.branch_id) {
    const branchKey = `${employee.branch_id}_${dayOfWeek}`
    const branchDefault = data.branches.get(branchKey)
    if (branchDefault?.shift_templates) {
      const st = branchDefault.shift_templates
      return {
        shift_id: st.id,
        name: st.name,
        start_time: st.start_time,
        end_time: st.end_time,
        color_code: st.color_code || '#64748b',
        source_level: 4,
        source_name: 'Predeterminado de Sucursal',
        lunch_duration: st.lunch_duration || 0,
        late_entry_tolerance: st.late_entry_tolerance || 15,
        early_exit_tolerance: st.early_exit_tolerance || 15,
        days_config: st.days_config
      }
    }
  }

  return null
}

/**
 * ORIGINAL resolveShift (Sequential DB queries)
 * Maintained for the Kiosk which needs real-time single lookup.
 */
export async function resolveShift(
  supabase: SupabaseClient,
  employeeId: string,
  date: Date,
  context: {
    companyId: string
    branchId: string
    jobPositionId: string | null
  }
): Promise<ResolvedShift | null> {
  const dateISO = date.toISOString().split('T')[0]
  const dayOfWeek = date.getDay()

  // LEVEL 1: OVERRIDE
  const { data: override } = await supabase
    .from('employee_shift_overrides')
    .select(`
      shift_template_id, 
      shift_templates(id, name, start_time, end_time, color_code, lunch_duration, late_entry_tolerance, early_exit_tolerance, days_config)
    `)
    .eq('employee_id', employeeId)
    .eq('scheduled_date', dateISO)
    .maybeSingle()

  if (override?.shift_templates) {
    const st = override.shift_templates as any
    return {
      shift_id: st.id,
      name: st.name,
      start_time: st.start_time,
      end_time: st.end_time,
      color_code: st.color_code || '#64748b',
      source_level: 1,
      source_name: 'Excepción de Día',
      lunch_duration: st.lunch_duration || 0,
      late_entry_tolerance: st.late_entry_tolerance || 15,
      early_exit_tolerance: st.early_exit_tolerance || 15,
      days_config: st.days_config
    }
  }

  // LEVEL 2: MANUAL FIXED - Legacy Shifts Fallback
  const { data: manualAssignment } = await supabase
    .from('employee_shifts')
    .select(`
      shift_id,
      shifts!inner(id, name, start_time, end_time, color_code, tolerance_in, tolerance_out, break_minutes, days_of_week)
    `)
    .eq('employee_id', employeeId)
    .eq('is_active', true)
    .maybeSingle()

  if (manualAssignment?.shifts) {
    const s = manualAssignment.shifts as any
    if (s.days_of_week?.includes(dayOfWeek)) {
      return {
        shift_id: s.id,
        name: s.name,
        start_time: s.start_time,
        end_time: s.end_time,
        color_code: s.color_code || '#64748b',
        source_level: 2,
        source_name: 'Asignación Fija',
        lunch_duration: s.break_minutes || 60,
        late_entry_tolerance: s.tolerance_in || 15,
        early_exit_tolerance: s.tolerance_out || 15,
        days_config: []
      }
    }
  }

  // LEVEL 3: GLOBAL
  if (context.jobPositionId) {
    const { data: globalSched } = await supabase
      .from('global_schedules')
      .select(`
        shift_template_id, 
        shift_templates(id, name, start_time, end_time, color_code, lunch_duration, late_entry_tolerance, early_exit_tolerance, days_config)
      `)
      .eq('job_position_id', context.jobPositionId)
      .eq('day_of_week', dayOfWeek)
      .maybeSingle()

    if (globalSched?.shift_templates) {
      const st = globalSched.shift_templates as any
      return {
        shift_id: st.id,
        name: st.name,
        start_time: st.start_time,
        end_time: st.end_time,
        color_code: st.color_code || '#64748b',
        source_level: 3,
        source_name: 'Planilla Global',
        lunch_duration: st.lunch_duration || 0,
        late_entry_tolerance: st.late_entry_tolerance || 15,
        early_exit_tolerance: st.early_exit_tolerance || 15,
        days_config: st.days_config
      }
    }
  }

  // LEVEL 4: BRANCH DEFAULT
  const { data: branchDefault } = await supabase
    .from('branch_default_shifts')
    .select(`
      shift_template_id, 
      shift_templates(id, name, start_time, end_time, color_code, lunch_duration, late_entry_tolerance, early_exit_tolerance, days_config)
    `)
    .eq('branch_id', context.branchId)
    .eq('day_of_week', dayOfWeek)
    .maybeSingle()

  if (branchDefault?.shift_templates) {
    const st = branchDefault.shift_templates as any
    return {
      shift_id: st.id,
      name: st.name,
      start_time: st.start_time,
      end_time: st.end_time,
      color_code: st.color_code || '#64748b',
      source_level: 4,
      source_name: 'Predeterminado de Sucursal',
      lunch_duration: st.lunch_duration || 0,
      late_entry_tolerance: st.late_entry_tolerance || 15,
      early_exit_tolerance: st.early_exit_tolerance || 15,
      days_config: st.days_config
    }
  }

  return null
}
