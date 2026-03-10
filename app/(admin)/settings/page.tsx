import { createClient } from '@/lib/supabase/server'
import { AppearanceForm } from './_components/appearance-form'

export default async function SettingsPage() {
  const supabase = await createClient()

  const { data: appSettings } = await supabase
    .from('app_settings')
    .select('key, value')

  const settings = Object.fromEntries(
    (appSettings ?? []).map((r) => [r.key, r.value as string | null])
  )

  const { data: company } = await supabase
    .from('companies')
    .select('display_name, legal_name, slug, tax_id, is_active, created_at')
    .single()

  const { data: branches } = await supabase
    .from('branches')
    .select('id, name, code, is_active')
    .order('name')

  const { data: leaveTypes } = await supabase
    .from('leave_types')
    .select('id, code, name, is_paid, requires_balance, default_days_per_year, is_active')
    .order('name')

  const infoRows = company
    ? [
        { label: 'Nombre de empresa',   value: company.display_name },
        { label: 'Razón social',         value: company.legal_name },
        { label: 'Slug / identificador', value: company.slug },
        { label: 'RUC / NIT',            value: company.tax_id ?? '—' },
        { label: 'Zona horaria',          value: 'America/Managua' },
        { label: 'Estado',               value: company.is_active ? 'Operativo' : 'Inactivo' },
        { label: 'Creado',               value: new Date(company.created_at).toLocaleDateString('es-NI') },
      ]
    : []

  return (
    <section className="space-y-6">

      <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-400">Sistema</p>
        <h1 className="mt-2 text-3xl font-bold text-slate-900">Configuración</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
          Parámetros generales de la empresa, sucursales activas y tipos de permiso configurados.
        </p>
      </div>

      {/* Apariencia */}
      <div className="rounded-3xl bg-white shadow-sm ring-1 ring-slate-200 overflow-hidden">
        <div className="border-b border-slate-100 px-6 py-4">
          <h2 className="text-base font-semibold text-slate-900">Apariencia</h2>
          <p className="mt-1 text-xs text-slate-500">
            Logo, favicon e imagen de fondo del kiosko. Los cambios se aplican en tiempo real.
          </p>
        </div>
        <div className="p-6">
          <AppearanceForm
            logoUrl={settings.logo_url ?? null}
            faviconUrl={settings.favicon_url ?? null}
            kioskBgUrl={settings.kiosk_bg_url ?? null}
          />
        </div>
      </div>

      {/* Información de la empresa */}
      <div className="rounded-3xl bg-white shadow-sm ring-1 ring-slate-200 overflow-hidden">
        <div className="border-b border-slate-100 px-6 py-4">
          <h2 className="text-base font-semibold text-slate-900">Datos de la empresa</h2>
        </div>
        {infoRows.length > 0 ? (
          <dl className="divide-y divide-slate-100">
            {infoRows.map((row) => (
              <div key={row.label} className="grid grid-cols-[200px_1fr] gap-4 px-6 py-4">
                <dt className="text-sm font-medium text-slate-500">{row.label}</dt>
                <dd className="text-sm text-slate-900">{row.value}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <div className="px-6 py-12 text-center text-sm text-slate-400">
            No hay datos de empresa. Inicia sesión para ver la configuración.
          </div>
        )}
      </div>

      {/* Sucursales */}
      {branches && branches.length > 0 && (
        <div className="rounded-3xl bg-white shadow-sm ring-1 ring-slate-200 overflow-hidden">
          <div className="border-b border-slate-100 px-6 py-4">
            <h2 className="text-base font-semibold text-slate-900">
              Sucursales ({branches.length})
            </h2>
          </div>
          <div className="divide-y divide-slate-100">
            {branches.map((b) => (
              <div key={b.id} className="flex items-center justify-between px-6 py-4">
                <div>
                  <p className="text-sm font-medium text-slate-900">{b.name}</p>
                  {b.code && (
                    <p className="text-xs text-slate-400 font-mono">{b.code}</p>
                  )}
                </div>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${b.is_active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                  {b.is_active ? 'Activa' : 'Inactiva'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tipos de permiso */}
      {leaveTypes && leaveTypes.length > 0 && (
        <div className="rounded-3xl bg-white shadow-sm ring-1 ring-slate-200 overflow-hidden">
          <div className="border-b border-slate-100 px-6 py-4">
            <h2 className="text-base font-semibold text-slate-900">
              Tipos de permiso ({leaveTypes.length})
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50 text-left">
                  <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Tipo</th>
                  <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Código</th>
                  <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Remunerado</th>
                  <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Días/año</th>
                  <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {leaveTypes.map((lt) => (
                  <tr key={lt.id} className="hover:bg-slate-50">
                    <td className="px-6 py-4 font-medium text-slate-900">{lt.name}</td>
                    <td className="px-6 py-4 font-mono text-xs text-slate-400">{lt.code}</td>
                    <td className="px-6 py-4 text-slate-600">{lt.is_paid ? 'Sí' : 'No'}</td>
                    <td className="px-6 py-4 text-slate-600">
                      {lt.default_days_per_year ?? '—'}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${lt.is_active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                        {lt.is_active ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </section>
  )
}
