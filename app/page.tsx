import { createClient } from '@/lib/supabase/server'
import { KioskClient } from './_components/kiosk-client'

export default async function KioskPage() {
  const supabase = await createClient()

  const [{ data: rows }, { data: branches }] = await Promise.all([
    supabase
      .from('app_settings')
      .select('key, value')
      .in('key', ['logo_url', 'kiosk_bg_url', 'company_name', 'kiosk_custom_message']),
    supabase
      .from('branches')
      .select('id, name')
      .eq('is_active', true)
      .order('name')
      .limit(1),
  ])

  const settings = Object.fromEntries(
    (rows ?? []).map((r) => [r.key, r.value as string | null])
  )

  const branch = branches?.[0] ?? null

   return (
    <KioskClient
      initialLogoUrl={settings.logo_url ?? null}
      initialKioskBgUrl={settings.kiosk_bg_url ?? null}
      initialCompanyName={settings.company_name ?? 'Grupo CT'}
      initialCustomMessage={settings.kiosk_custom_message ?? 'Gracias por su puntualidad'}
      initialBranchId={branch?.id ?? null}
    />
  )
}
