'use server'

import { createClient } from '@/lib/supabase/server'
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
      branches!inner (
        name,
        companies!inner (
          display_name,
          logo_url
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
      logo_url: company.logo_url
    },
    error: null
  }
}

export async function registerKioskDevice(branchId: string, deviceCode: string) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('kiosk_devices')
    .insert({
      branch_id: branchId,
      device_code: deviceCode.toLowerCase()
    })

  if (error) return { error: error.message }
  
  revalidatePath('/(admin)/organization/kiosks')
  return { success: true }
}

export async function getKioskDevices() {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('kiosk_devices')
    .select(`
      id,
      device_code,
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
  return { data, error: null }
}

export async function deleteKioskDevice(id: string) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('kiosk_devices')
    .delete()
    .eq('id', id)

  if (error) return { error: error.message }
  
  revalidatePath('/(admin)/organization/kiosks')
  return { success: true }
}
