import { ModulePlaceholder } from '../_components/module-placeholder'

export default function Page() {
  return (
    <ModulePlaceholder
      title="Empleados"
      description="Listado maestro de colaboradores con perfil, estado, PIN, sucursal y turno asignado."
      stats={[
        { label: 'Activos', value: '128' },
        { label: 'Inactivos', value: '9' },
        { label: 'Sin turno', value: '4' },
        { label: 'PIN reseteados hoy', value: '2' },
      ]}
      bullets={[
        'tabla principal',
        'filtros por sucursal',
        'acciones por fila',
        'creación de empleado',
      ]}
    />
  )
}
