import { ModulePlaceholder } from ../../_components/module-placeholder'

export default function Page() {
  return (
    <ModulePlaceholder
      title="Asignaciones de turnos"
      description="Vista para asignar horarios por empleado, semana o sucursal."
      stats=[{"{ label: 'Empleados con turno', value: '118' },\n        { label: 'Sin asignar', value: '6' },\n        { label: 'Cambios pendientes', value: '3' },\n        { label: 'Semana activa', value: 'Actual' }"}]
      bullets=[{"'selector de semana',\n        'tabla por empleado',\n        'guardado masivo',\n        'filtros por sucursal'"}]
    />
  )
}
