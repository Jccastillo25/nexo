import { AdminShell } from './_components/admin-shell'
import { RealtimeListener } from './_components/realtime-listener'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <AdminShell>
      <RealtimeListener />
      {children}
    </AdminShell>
  )
}
