import { ModulePlaceholder } from '../../_components/module-placeholder'

export default function Page() {
  return (
    <ModulePlaceholder
      title="Correcciones"
      description="Revisión visual de solicitudes de ajuste de marcaciones y cambios manuales."
      stats={[
        { label: 'Pendientes', value: '7' },
        { label: 'Aprobadas hoy', value: '3' },
        { label: 'Rechazadas hoy', value: '1' },
        { label: 'Con evidencia', value: '4' },
      ]}
      bullets={[
        'tabs por estado',
        'tabla de solicitudes',
        'drawer de detalle',
        'acciones aprobar/rechazar',
      ]}
    />
  )
}
