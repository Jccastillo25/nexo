'use server'

import { createClient } from '../../src/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { KioskDevice } from '../types/kiosk'

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
