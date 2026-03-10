import { ModulePlaceholder } from ../_components/module-placeholder'

export default function Page() {
  return (
    <ModulePlaceholder
      title="Empleados"
      description="Listado maestro de colaboradores con perfil, estado, PIN, sucursal y turno asignado."
      stats=[{"{ label: 'Activos', value: '128' },\n        { label: 'Inactivos', value: '9' },\n        { label: 'Sin turno', value: '4' },\n        { label: 'PIN reseteados hoy', value: '2' }"}]
      bullets=[{"'tabla principal',\n        'filtros por sucursal',\n        'acciones por fila',\n        'creación de empleado'"}]
    />
  )
}
