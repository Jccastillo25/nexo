import { ModulePlaceholder } from '../../_components/module-placeholder'

export default function Page() {
  return (
    <ModulePlaceholder
      title="Registros de asistencia"
      description="Consulta detallada de marcaciones por empleado, fecha, sucursal y estado."
      stats={[
        { label: 'Registros hoy', value: '241' },
        { label: 'Entradas', value: '118' },
        { label: 'Salidas', value: '111' },
        { label: 'Pendientes', value: '12' },
      ]}
      bullets={[
        'filtros por fecha y empleado',
        'tabla principal',
        'exportación',
        'detalle lateral',
      ]}
    />
  )
}
