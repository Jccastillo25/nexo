'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getNicaTimeParts } from '@/lib/date-utils'
import { revalidatePath } from 'next/cache'
import { KioskDevice, EventType, KioskResult } from '../types/kiosk'

export async function getKioskByDeviceCode(code: string): Promise<{ data: KioskDevice | null; error: string | null }> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('kiosk_devices')
    .select(`
      id,
      branch_id,
      device_code,
      name,
      location,
      notes,
      is_active,
      branches!inner (
        name,
        companies!inner (
          display_name
        )
      )
    `)
    .eq('device_code', code.toLowerCase())
    .single()

  if (error || !data) {
    if (error?.code === 'PGRST116') {
      return { data: null, error: 'Código de dispositivo no encontrado.' }
    }
    return { data: null, error: error?.message || 'Error desconocido' }
  }

  const branch = data.branches as any
  const company = branch.companies as any

  return {
    data: {
      id: data.id,
      branch_id: data.branch_id,
      device_code: data.device_code,
      branch_name: branch.name,
      company_name: company.display_name,
      logo_url: null,
      name: data.name,
      location: data.location,
      notes: data.notes,
      is_active: data.is_active
    },
    error: null
  }
}

export async function registerKioskDevice(
  branchId: string, 
  name: string, 
  location?: string, 
  notes?: string
) {
  const supabase = await createClient()

  // 1. Fetch branch and company info for code generation
  const { data: branch, error: branchErr } = await supabase
    .from('branches')
    .select('name, code, companies(slug, display_name)')
    .eq('id', branchId)
    .single()

  if (branchErr || !branch) return { error: 'No se pudo obtener la información de la sucursal.' }

  const company = branch.companies as any
  const companyPart = (company.slug || company.display_name.split(' ')[0]).toLowerCase().substring(0, 5)
  const branchPart = (branch.code || branch.name.split(' ')[0]).toLowerCase().substring(0, 5)

  // 2. Count existing kiosks for this branch to get the sequence
  const { count, error: countErr } = await supabase
    .from('kiosk_devices')
    .select('*', { count: 'exact', head: true })
    .eq('branch_id', branchId)

  if (countErr) return { error: 'No se pudo generar el código secuencial.' }

  const sequence = String((count || 0) + 1).padStart(2, '0')
  const deviceCode = `${companyPart}-${branchPart}-ki-${sequence}`

  // 3. Insert the new device
  const { error } = await supabase
    .from('kiosk_devices')
    .insert({
      branch_id: branchId,
      device_code: deviceCode,
      name,
      location: location || null,
      notes: notes || null,
      is_active: true
    })

  if (error) return { error: error.message }
  
  revalidatePath('/kiosk/devices')
  return { success: true, deviceCode }
}

export async function updateKioskDevice(
  id: string,
  data: {
    name?: string
    location?: string
    notes?: string
    is_active?: boolean
  }
) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('kiosk_devices')
    .update(data)
    .eq('id', id)

  if (error) return { error: error.message }
  
  revalidatePath('/kiosk/devices')
  return { success: true }
}

export async function getKioskDevices() {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('kiosk_devices')
    .select(`
      id,
      device_code,
      name,
      location,
      notes,
      is_active,
      last_seen,
      created_at,
      branches (
        name,
        companies (
          display_name
        )
      )
    `)
    .order('created_at', { ascending: false })

  if (error) return { data: null, error: error.message }

  const formattedData = data.map((d: any) => ({
    ...d,
    branch_name: d.branches?.name,
    company_name: d.branches?.companies?.display_name
  }))

  return { data: formattedData, error: null }
}

export async function deleteKioskDevice(id: string) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('kiosk_devices')
    .delete()
    .eq('id', id)

  if (error) return { error: error.message }
  
  revalidatePath('/kiosk/devices')
  return { success: true }
}

export async function verifyKioskPin(pin: string, branchId: string): Promise<{ success: boolean; employeeName?: string; error?: string }> {
  // Use admin client to ensure we can read employee and shift data even from a public kiosk
  const supabase = createAdminClient()

  // Single query: fetch the employee by PIN with their branch info included.
  // We fetch both branch_id and the branch name in one shot so we never need a second query.
  const { data: employee, error: empErr } = await supabase
    .from('employees')
    .select('id, first_name, last_name, company_id, branch_id, is_active, employee_code, employee_shifts(is_active), branches(name)')
    .eq('employee_code', pin)
    .maybeSingle()

  if (empErr) {
    console.error('Kiosk PIN verification DB error:', empErr.message)
    return { success: false, error: 'Error técnico al validar PIN. Por favor, intente de nuevo.' }
  }

  if (!employee) {
    return { success: false, error: 'PIN incorrecto o empleado no encontrado.' }
  }

  // Check if the employee belongs to this branch
  if (employee.branch_id !== branchId) {
    const branchName = (employee.branches as any)?.name || 'otra sucursal'
    return { success: false, error: `PIN correcto pero el empleado está asignado a: ${branchName}.` }
  }

  if (!employee.is_active) {
    return { success: false, reason: 'El empleado está inactivo.' } as any
  }

  if (!employee.employee_code) {
    return { success: false, error: 'El empleado no tiene un PIN configurado.' }
  }

  return {
    success: true,
    employeeName: `${employee.first_name} ${employee.last_name}`
  }
}

/**
 * Get the correct shift for today based on the current day of week.
 * Handles different shifts for different days (e.g., Saturday has different hours).
 * Uses shift_schedules table for per-day hour variations within a single shift.
 */
async function getTodayShift(
  supabase: any,
  employeeId: string,
  companyId: string
): Promise<{ start_time: string; tolerance_in: number } | null> {
  // Get today's day of week (0 = Sunday, 1 = Monday, ..., 6 = Saturday)
  // Our system uses (1 = Monday, ..., 6 = Saturday), so we need to adjust
  const today = new Date()
  const dayOfWeek = today.getDay() === 0 ? 6 : today.getDay() // Convert Sunday (0) to 6, keep 1-5 as is

  // Fetch employee's shift assignment
  const { data: employeeShift, error: shiftErr } = await supabase
    .from('employee_shifts')
    .select(`
      shift_id,
      shifts!left(id)
    `)
    .eq('employee_id', employeeId)
    .eq('is_active', true)
    .maybeSingle()

  if (shiftErr || !employeeShift?.shifts) {
    return null
  }

  const shiftId = employeeShift.shifts.id

  // Try to find specific schedule for this shift on this day of week
  const { data: daySchedule, error: schedErr } = await supabase
    .from('shift_schedules')
    .select('start_time, tolerance_in')
    .eq('shift_id', shiftId)
    .eq('day_of_week', dayOfWeek)
    .maybeSingle()

  if (!schedErr && daySchedule) {
    return {
      start_time: daySchedule.start_time,
      tolerance_in: daySchedule.tolerance_in || 0
    }
  }

  // Fallback: If no specific schedule found, try the shift's default hours
  const { data: shift } = await supabase
    .from('shifts')
    .select('start_time, tolerance_in, days_of_week')
    .eq('id', shiftId)
    .maybeSingle()

  if (shift && shift.days_of_week && Array.isArray(shift.days_of_week)) {
    if (shift.days_of_week.includes(dayOfWeek)) {
      return {
        start_time: shift.start_time,
        tolerance_in: shift.tolerance_in || 0
      }
    }
  }

  return null
}

export async function processKioskEvent(branchId: string, pin: string, eventType: EventType): Promise<KioskResult> {
  const supabase = createAdminClient()

  // 1. Verify existence and active status
  const { data: employee, error: empErr } = await supabase
    .from('employees')
    .select(`
      id, first_name, last_name, is_active, employee_code, company_id,
      job_positions!left(default_break_mins)
    `)
    .eq('employee_code', pin)
    .eq('branch_id', branchId)
    .maybeSingle()

  if (empErr || !employee || !employee.is_active) {
    return { success: false, error: 'PIN incorrecto o empleado no encontrado en esta sucursal.' }
  }

  // Tardiness Calculation Logic
  let tardinessMinutes = 0
  if (eventType === 'clock_in') {
    // Get the correct shift for today (handles Saturday vs weekday)
    const todayShift = await getTodayShift(supabase, employee.id, employee.company_id)

    if (todayShift && todayShift.start_time) {
      const { hour, minute } = getNicaTimeParts()
      const currentTotalMins = hour * 60 + minute

      const [shiftHours, shiftMins] = todayShift.start_time.split(':').map(Number)
      const shiftTotalMins = shiftHours * 60 + shiftMins
      const tolerance = todayShift.tolerance_in || 0

      if (currentTotalMins > shiftTotalMins + tolerance) {
        tardinessMinutes = currentTotalMins - shiftTotalMins
      }
    }
  }

  const now = new Date().toISOString()

  // Determine next employee status upfront
  let nextStatus = 'offline'
  if (eventType === 'clock_in' || eventType === 'break_in') nextStatus = 'active'
  if (eventType === 'break_out') nextStatus = 'on_break'

  // 2 & 3. Run attendance log write + employee status update in parallel
  if (eventType === 'clock_in') {
    const [{ error: insertErr }] = await Promise.all([
      supabase.from('attendance_logs').insert({
        employee_id: employee.id,
        clock_in: now,
        status: tardinessMinutes > 0 ? 'late' : 'on_time',
        source_origin: 'KIOSK'
      }),
      supabase.from('employees').update({
        current_status: nextStatus,
        last_status_change: now
      }).eq('id', employee.id)
    ])
    if (insertErr) return { success: false, error: `Error al registrar entrada: ${insertErr.message}` }

  } else if (eventType === 'clock_out') {
    // Find open session first (needs the id), then update log + employee status in parallel
    const { data: openLog } = await supabase
      .from('attendance_logs')
      .select('id')
      .eq('employee_id', employee.id)
      .is('clock_out', null)
      .order('clock_in', { ascending: false })
      .limit(1)
      .maybeSingle()

    await Promise.all([
      openLog
        ? supabase.from('attendance_logs').update({ clock_out: now }).eq('id', openLog.id)
        : Promise.resolve(),
      supabase.from('employees').update({
        current_status: nextStatus,
        last_status_change: now
      }).eq('id', employee.id)
    ])

  } else if (eventType === 'break_out') {
    // Start break: insert status log + update employee status in parallel
    const breakMins = (employee.job_positions as any)?.default_break_mins || 60
    const startTime = new Date()
    const endTimeScheduled = new Date(startTime.getTime() + breakMins * 60000)

    await Promise.all([
      supabase.from('employee_status_logs').insert({
        employee_id: employee.id,
        start_time: startTime.toISOString(),
        end_time_scheduled: endTimeScheduled.toISOString(),
      }),
      supabase.from('employees').update({
        current_status: nextStatus,
        last_status_change: now
      }).eq('id', employee.id)
    ])

  } else if (eventType === 'break_in') {
    // End break: close open break log + update employee status in parallel
    await Promise.all([
      supabase.from('employee_status_logs')
        .update({ end_time_actual: now })
        .eq('employee_id', employee.id)
        .is('end_time_actual', null),
      supabase.from('employees').update({
        current_status: nextStatus,
        last_status_change: now
      }).eq('id', employee.id)
    ])
  }

  // Revalidate paths to update dashboards
  revalidatePath('/dashboard')
  revalidatePath('/attendance')
  revalidatePath('/monitor')

  return {
    success: true,
    employee_name: `${employee.first_name} ${employee.last_name}`,
    employee_code: employee.employee_code,
    event_type: eventType,
    tardiness_minutes: tardinessMinutes,
    overtime_minutes: 0
  }
}
