import { SupabaseClient } from '@supabase/supabase-js'

/**
 * Generates a unique 4-digit PIN that doesn't exist in the employees table for a given company.
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
    // (should be very rare for 4 digits unless the company has >5000 employees)
    throw new Error('No se pudo generar un PIN único después de varios intentos.')
  }

  return pin
}
