import { ModulePlaceholder } from ../../_components/module-placeholder'

export default function Page() {
  return (
    <ModulePlaceholder
      title="Correcciones"
      description="Revisión visual de solicitudes de ajuste de marcaciones y cambios manuales."
      stats=[{"{ label: 'Pendientes', value: '7' },\n        { label: 'Aprobadas hoy', value: '3' },\n        { label: 'Rechazadas hoy', value: '1' },\n        { label: 'Con evidencia', value: '4' }"}]
      bullets=[{"'tabs por estado',\n        'tabla de solicitudes',\n        'drawer de detalle',\n        'acciones aprobar/rechazar'"}]
    />
  )
}
