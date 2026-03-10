import { createClient } from '@/lib/supabase/server'
import { KioskClient } from './_components/kiosk-client'

export default async function KioskPage() {
  const supabase = await createClient()

  const [{ data: rows }, { data: branches }] = await Promise.all([
    supabase
      .from('app_settings')
      .select('key, value')
      .in('key', ['logo_url', 'kiosk_bg_url', 'company_name']),
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
      logoUrl={settings.logo_url ?? null}
      kioskBgUrl={settings.kiosk_bg_url ?? null}
      companyName={settings.company_name ?? 'Grupo CT'}
      branchId={branch?.id ?? null}
      branchName={branch?.name ?? null}
    />
  )
}
