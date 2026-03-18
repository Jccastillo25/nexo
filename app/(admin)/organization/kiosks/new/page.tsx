'use server'

import { createClient } from '@/lib/supabase/server'
import { registerKioskDevice } from '@/app/actions/kiosk'
import { redirect } from 'next/navigation'

export default async function NewKioskPage() {
  const supabase = await createClient()

  const { data: branches } = await supabase
    .from('branches')
    .select('id, name, companies(display_name)')
    .eq('is_active', true)
    .order('name')

  async function handleSubmit(formData: FormData) {
    'use server'
    const branchId = formData.get('branchId') as string
    const deviceCode = formData.get('deviceCode') as string

    if (!branchId || !deviceCode) return

    const { error } = await registerKioskDevice(branchId, deviceCode)
    if (!error) {
      redirect('/organization/kiosks')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Vincular Nuevo Kiosko</h1>
          <p className="text-muted-foreground">Asigna un código de dispositivo a una sucursal específica.</p>
        </div>
      </div>

      <div className="max-w-xl rounded-xl border bg-card p-6 shadow-sm">
        <form action={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
              Sucursal
            </label>
            <select
              name="branchId"
              required
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <option value="">Selecciona una sucursal</option>
              {branches?.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} ({(b.companies as any).display_name})
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
              Código de Dispositivo
            </label>
            <input
              name="deviceCode"
              type="text"
              required
              placeholder="Ej: DELL01, CAJA-01"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            />
            <p className="text-[10px] text-muted-foreground uppercase font-bold px-1">
              Este código debe ser ingresado en la pantalla de vinculación del kiosko.
            </p>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="submit"
              className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-8 text-sm font-medium text-primary-foreground ring-offset-background transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
            >
              Guardar Vinculación
            </button>
            <a
              href="/organization/kiosks"
              className="inline-flex h-10 items-center justify-center rounded-md border border-input bg-background px-8 text-sm font-medium ring-offset-background transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
            >
              Cancelar
            </a>
          </div>
        </form>
      </div>
    </div>
  )
}
