import { AdminShell } from './_components/admin-shell'
import { RealtimeListener } from './_components/realtime-listener'

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
