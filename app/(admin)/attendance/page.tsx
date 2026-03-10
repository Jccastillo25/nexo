import { ModulePlaceholder } from '../_components/module-placeholder'

export default function Page() {
  return (
    <ModulePlaceholder
      title="Asistencia"
      description="Módulo para monitorear marcaciones, revisar registros, correcciones e incidencias operativas."
      stats={[
        { label: 'Marcaciones hoy', value: '241' },
        { label: 'Incidencias', value: '13' },
        { label: 'Pendientes revisión', value: '7' },
        { label: 'Sucursales activas', value: '4' },
      ]}
      bullets={[
        'feed en vivo',
        'tabla resumen',
        'estado por sucursal',
        'acciones rápidas',
      ]}
    />
  )
}
