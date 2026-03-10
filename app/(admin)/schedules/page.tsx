import { ModulePlaceholder } from ../_components/module-placeholder'

export default function Page() {
  return (
    <ModulePlaceholder
      title="Horarios"
      description="Gestión visual de turnos, reglas base y configuración general de jornadas."
      stats=[{"{ label: 'Turnos creados', value: '12' },\n        { label: 'Asignaciones activas', value: '118' },\n        { label: 'Sin asignar', value: '6' },\n        { label: 'Cambios esta semana', value: '14' }"}]
      bullets=[{"'tabla de turnos',\n        'edición rápida',\n        'estado activo/inactivo',\n        'configuración por empresa'"}]
    />
  )
}
