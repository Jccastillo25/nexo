import { getKioskDevices, deleteKioskDevice } from '@/app/actions/kiosk'
import Link from 'next/link'
import { revalidatePath } from 'next/cache'

export default async function KiosksPage() {
  const { data: devices, error } = await getKioskDevices()

  async function handleDelete(id: string) {
    'use server'
    await deleteKioskDevice(id)
    revalidatePath('/organization/kiosks')
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dispositivos Kiosko</h1>
          <p className="text-muted-foreground">Administra los dispositivos autorizados para el marcaje.</p>
        </div>
        <Link
          href="/organization/kiosks/new"
          className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground ring-offset-background transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
        >
          <svg className="mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
          </svg>
          Nuevo Kiosko
        </Link>
      </div>

      <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-muted/50 border-b">
            <tr>
              <th className="px-4 py-3 font-semibold uppercase tracking-wider text-[10px]">Código</th>
              <th className="px-4 py-3 font-semibold uppercase tracking-wider text-[10px]">Sucursal</th>
              <th className="px-4 py-3 font-semibold uppercase tracking-wider text-[10px]">Empresa</th>
              <th className="px-4 py-3 font-semibold uppercase tracking-wider text-[10px]">Último Acceso</th>
              <th className="px-4 py-3 font-semibold uppercase tracking-wider text-[10px] text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {devices?.map((device) => (
              <tr key={device.id} className="hover:bg-muted/30 transition-colors">
                <td className="px-4 py-4 font-mono font-bold text-primary">{device.device_code}</td>
                <td className="px-4 py-4">{(device.branches as any).name}</td>
                <td className="px-4 py-4 text-muted-foreground">{(device.branches as any).companies.display_name}</td>
                <td className="px-4 py-4 text-muted-foreground">
                  {device.last_seen ? new Date(device.last_seen).toLocaleString('es-NI') : 'Nunca'}
                </td>
                <td className="px-4 py-4 text-right">
                  <form action={handleDelete.bind(null, device.id)}>
                    <button
                      type="submit"
                      className="text-red-500 hover:text-red-700 font-bold text-xs uppercase transition-colors"
                    >
                      Desvincular
                    </button>
                  </form>
                </td>
              </tr>
            ))}
            {(!devices || devices.length === 0) && (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-muted-foreground">
                  No hay dispositivos vinculados. Haz clic en "Nuevo Kiosko" para empezar.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
