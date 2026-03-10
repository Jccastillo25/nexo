import { ModulePlaceholder } from ../_components/module-placeholder'

export default function Page() {
  return (
    <ModulePlaceholder
      title="Permisos y ausencias"
      description="Control de solicitudes, tipos de permiso, aprobaciones y estados del equipo."
      stats=[{"{ label: 'Solicitudes pendientes', value: '5' },\n        { label: 'Aprobadas hoy', value: '3' },\n        { label: 'Rechazadas hoy', value: '1' },\n        { label: 'Tipos configurados', value: '8' }"}]
      bullets=[{"'tabs por estado',\n        'calendario de ausencias',\n        'detalle de saldo',\n        'acciones de aprobación'"}]
    />
  )
}
