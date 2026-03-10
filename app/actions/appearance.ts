'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function saveSetting(key: string, value: string | null) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('app_settings')
    .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' })

  if (error) return { error: error.message }

  revalidatePath('/', 'layout')
  revalidatePath('/settings')
  return { success: true }
}

export async function getSettings(): Promise<Record<string, string | null>> {
  const supabase = await createClient()
  const { data } = await supabase.from('app_settings').select('key, value')
  if (!data) return {}
  return Object.fromEntries(data.map((r) => [r.key, r.value]))
}
