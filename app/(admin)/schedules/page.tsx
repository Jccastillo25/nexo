import { ModulePlaceholder } from '../_components/module-placeholder'

export default function Page() {
  return (
    <ModulePlaceholder
      title="Horarios"
      description="Gestión visual de turnos, reglas base y configuración general de jornadas."
      stats={[
        { label: 'Turnos creados', value: '12' },
        { label: 'Asignaciones activas', value: '118' },
        { label: 'Sin asignar', value: '6' },
        { label: 'Cambios esta semana', value: '14' },
      ]}
      bullets={[
        'tabla de turnos',
        'edición rápida',
        'estado activo/inactivo',
        'configuración por empresa',
      ]}
    />
  )
}
