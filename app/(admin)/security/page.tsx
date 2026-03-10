import { ModulePlaceholder } from ../_components/module-placeholder'

export default function Page() {
  return (
    <ModulePlaceholder
      title="Seguridad y auditoría"
      description="Control visual de roles, permisos y trazabilidad de acciones sensibles."
      stats=[{"{ label: 'Roles base', value: '3' },\n        { label: 'Eventos hoy', value: '42' },\n        { label: 'Acciones críticas', value: '6' },\n        { label: 'Alertas', value: '0' }"}]
      bullets=[{"'tabla de auditoría',\n        'roles por módulo',\n        'logs recientes',\n        'detalle de cambios'"}]
    />
  )
}
