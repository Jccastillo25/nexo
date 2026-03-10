import { ModulePlaceholder } from '../../_components/module-placeholder'

export default function Page() {
  return (
    <ModulePlaceholder
      title="Asignaciones de turnos"
      description="Vista para asignar horarios por empleado, semana o sucursal."
      stats={[
        { label: 'Empleados con turno', value: '118' },
        { label: 'Sin asignar', value: '6' },
        { label: 'Cambios pendientes', value: '3' },
        { label: 'Semana activa', value: 'Actual' },
      ]}
      bullets={[
        'selector de semana',
        'tabla por empleado',
        'guardado masivo',
        'filtros por sucursal',
      ]}
    />
  )
}
