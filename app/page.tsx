import { createClient } from '@/lib/supabase/server'
import { KioskClient } from './_components/kiosk-client'

export default async function KioskPage() {
  const supabase = await createClient()

  const { data: rows } = await supabase
    .from('app_settings')
    .select('key, value')
    .in('key', ['logo_url', 'kiosk_bg_url'])

  const settings = Object.fromEntries(
    (rows ?? []).map((r) => [r.key, r.value as string | null])
  )

  return (
    <KioskClient
      logoUrl={settings.logo_url ?? null}
      kioskBgUrl={settings.kiosk_bg_url ?? null}
    />
  )
}
