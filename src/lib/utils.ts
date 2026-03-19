import { SupabaseClient } from '@supabase/supabase-js'

/**
 * Checks if a string has all identical characters (e.g., 1111, 2222)
 */
function isRepetitive(pin: string): boolean {
  return pin.split('').every(char => char === pin[0])
}

/**
 * Checks if a string has consecutive sequential characters (e.g., 1234, 4321)
 */
function isConsecutive(pin: string): boolean {
  const isAscending = '0123456789'.includes(pin)
  const isDescending = '9876543210'.includes(pin)
  return isAscending || isDescending
}

/**
 * Generates a unique 4-digit PIN that doesn't exist in the employees table for a given company,
 * and ensures it's not a weak PIN (like 1111, 1234).
 */
export async function generateUniquePin(supabase: SupabaseClient, companyId: string): Promise<string> {
  let pin = ''
  let isUnique = false
  let attempts = 0
  const maxAttempts = 100

  while (!isUnique && attempts < maxAttempts) {
    // Generate a 4-digit PIN (1000-9999)
    pin = Math.floor(1000 + Math.random() * 9000).toString()
    attempts++

    // Skip weak PINs
    if (isRepetitive(pin) || isConsecutive(pin)) {
      continue
    }

    // Check if this PIN already exists for active employees in the company
    const { count, error } = await supabase
      .from('employees')
      .select('*', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .eq('employee_code', pin)
      .eq('is_active', true)

    if (!error && count === 0) {
      isUnique = true
    }
  }

  if (!isUnique) {
    // Fallback or error if we couldn't find a unique PIN after many attempts
    throw new Error('No se pudo generar un PIN único y seguro después de varios intentos.')
  }

  return pin
}

/**
 * Utility to validate if an employee is ready to clock in at the Kiosk.
 * 1) Is Active
 * 2) Has PIN
 * 3) Has a Shift assigned
 */
export async function checkAttendanceReady(
  supabase: SupabaseClient,
  employeeId: string
): Promise<{ ready: boolean; reason?: string }> {
  
  const { data: employee, error } = await supabase
    .from('employees')
    .select('is_active, employee_code, employee_shifts(is_active)')
    .eq('id', employeeId)
    .single()

  if (error || !employee) {
    return { ready: false, reason: 'Empleado no encontrado.' }
  }

  if (!employee.is_active) {
    return { ready: false, reason: 'El empleado está inactivo.' }
  }

  if (!employee.employee_code) {
    return { ready: false, reason: 'El empleado no tiene un PIN configurado.' }
  }

  // Check active shift assignment (now optional to allow clocking in without a move-to-contracts-first approach)
  const activeShifts = employee.employee_shifts?.filter(s => s.is_active) ?? []
  if (activeShifts.length === 0) {
    // We return ready: true but we could log that no shift was found for punctuality calculation
    return { ready: true } 
  }

  return { ready: true }
}
