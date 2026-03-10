import { ModulePlaceholder } from '../_components/module-placeholder'

export default function Page() {
  return (
    <ModulePlaceholder
      title="Permisos y ausencias"
      description="Control de solicitudes, tipos de permiso, aprobaciones y estados del equipo."
      stats={[
        { label: 'Solicitudes pendientes', value: '5' },
        { label: 'Aprobadas hoy', value: '3' },
        { label: 'Rechazadas hoy', value: '1' },
        { label: 'Tipos configurados', value: '8' },
      ]}
      bullets={[
        'tabs por estado',
        'calendario de ausencias',
        'detalle de saldo',
        'acciones de aprobación',
      ]}
    />
  )
}
