import { ModulePlaceholder } from '../_components/module-placeholder'

export default function Page() {
  return (
    <ModulePlaceholder
      title="Seguridad y auditoría"
      description="Control visual de roles, permisos y trazabilidad de acciones sensibles."
      stats={[
        { label: 'Roles base', value: '3' },
        { label: 'Eventos hoy', value: '42' },
        { label: 'Acciones críticas', value: '6' },
        { label: 'Alertas', value: '0' },
      ]}
      bullets={[
        'tabla de auditoría',
        'roles por módulo',
        'logs recientes',
        'detalle de cambios',
      ]}
    />
  )
}
