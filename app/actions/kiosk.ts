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

  // Find the employee by PIN and branch_id directly
  const { data: employee, error: empErr } = await supabase
    .from('employees')
    .select('id, first_name, last_name, company_id, branch_id, is_active')
    .eq('employee_code', pin)
    .eq('branch_id', branchId)
    .maybeSingle()

  if (empErr) {
    console.error('Kiosk PIN verification DB error:', empErr.message)
    return { success: false, error: 'Error técnico al validar PIN. Por favor, intente de nuevo.' }
  }

  if (!employee) {
    // If not found in this branch, maybe the employee is in the company but another branch?
    // We check globally just to provide a better error message (diagnostics)
    const { data: globalCheck } = await supabase
      .from('employees')
      .select('id, branches(name)')
      .eq('employee_code', pin)
      .maybeSingle()

    if (globalCheck) {
      const branchName = (globalCheck.branches as any)?.name || 'otra sucursal'
      return { success: false, error: `PIN correcto pero el empleado está asignado a: ${branchName}.` }
    }

    return { success: false, error: 'PIN incorrecto o empleado no encontrado en esta sucursal.' }
  }

  // Import and run checkAttendanceReady
  const { checkAttendanceReady } = await import('@/lib/utils')
  const { ready, reason } = await checkAttendanceReady(supabase, employee.id)

  if (!ready) {
    return { success: false, error: reason }
  }

  return { 
    success: true, 
    employeeName: `${employee.first_name} ${employee.last_name}` 
  }
}

export async function processKioskEvent(branchId: string, pin: string, eventType: EventType): Promise<KioskResult> {
  const supabase = createAdminClient()

  // 1. Verify existence and active status
  const { data: employee, error: empErr } = await supabase
    .from('employees')
    .select(`
      id, first_name, last_name, is_active, employee_code, company_id,
      job_positions!left(default_break_mins),
      contracts!left(
        status,
        shifts!left(
          start_time, tolerance_in
        )
      )
    `)
    .eq('employee_code', pin)
    .eq('branch_id', branchId)
    .maybeSingle()

  if (empErr || !employee || !employee.is_active) {
    return { success: false, error: 'PIN incorrecto o empleado no encontrado en esta sucursal.' }
  }

  // Tardiness Calculation Logic
  let tardinessMinutes = 0
  if (eventType === 'clock_in' && employee.contracts) {
    const activeContract = employee.contracts.find((c: any) => c.status === 'active' && c.shifts)
    
    // Supabase TS bindings might type it as an array if it cannot infer the uniqueness
    const shiftRaw = activeContract?.shifts
    const shift = Array.isArray(shiftRaw) ? shiftRaw[0] : shiftRaw

    if (shift && shift.start_time) {
      const { hour, minute } = getNicaTimeParts()
      const currentTotalMins = hour * 60 + minute
      
      const [shiftHours, shiftMins] = shift.start_time.split(':').map(Number)
      const shiftTotalMins = shiftHours * 60 + shiftMins
      const tolerance = shift.tolerance_in || 0
      
      if (currentTotalMins > shiftTotalMins + tolerance) {
        tardinessMinutes = currentTotalMins - shiftTotalMins
      }
    }
  }

  // 2. Register the event in attendance_logs
  if (eventType === 'clock_in') {
    const { error: insertErr } = await supabase
      .from('attendance_logs')
      .insert({
        employee_id: employee.id,
        company_id: employee.company_id,
        branch_id: branchId,
        clock_in: new Date().toISOString(),
        status: tardinessMinutes > 0 ? 'late' : 'on_time',
        source_origin: 'KIOSK'
      })
    if (insertErr) return { success: false, error: `Error al registrar entrada: ${insertErr.message}` }
  } else if (eventType === 'clock_out') {
    // Find open session
    const { data: openLog } = await supabase
      .from('attendance_logs')
      .select('id')
      .eq('employee_id', employee.id)
      .is('clock_out', null)
      .order('clock_in', { ascending: false })
      .limit(1)
      .single()

    if (openLog) {
      await supabase
        .from('attendance_logs')
        .update({ clock_out: new Date().toISOString() })
        .eq('id', openLog.id)
    }
  }

  // 3. Update Employee current_status and last_status_change
  let nextStatus = 'offline'
  if (eventType === 'clock_in' || eventType === 'break_in') nextStatus = 'active'
  if (eventType === 'break_out') nextStatus = 'on_break'

  await supabase
    .from('employees')
    .update({ 
      current_status: nextStatus,
      last_status_change: new Date().toISOString()
    })
    .eq('id', employee.id)

  // 4. Handle employee_status_logs for breaks
  if (eventType === 'break_out') {
    const breakMins = (employee.job_positions as any)?.default_break_mins || 60
    const startTime = new Date()
    const endTimeScheduled = new Date(startTime.getTime() + breakMins * 60000)

    await supabase.from('employee_status_logs').insert({
      employee_id: employee.id,
      start_time: startTime.toISOString(),
      end_time_scheduled: endTimeScheduled.toISOString(),
    })
  } else if (eventType === 'break_in') {
    // Find the last open break log and close it
    await supabase
      .from('employee_status_logs')
      .update({ end_time_actual: new Date().toISOString() })
      .eq('employee_id', employee.id)
      .is('end_time_actual', null)
  }

  // 3. Revalidate path to update dashboards
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
