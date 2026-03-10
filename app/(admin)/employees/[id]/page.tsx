import { ModulePlaceholder } from '../../_components/module-placeholder'

export default function EmployeeDetailPage() {
  return (
    <ModulePlaceholder
      title="Perfil de empleado"
      description="Vista visual del perfil individual con tabs para datos generales, horarios, asistencia, PIN, permisos e historial."
      stats={[
        { label: 'Estado', value: 'Activo' },
        { label: 'Sucursal', value: 'SUC 02' },
        { label: 'Turno', value: 'Diurno' },
        { label: 'PIN', value: '••••' },
      ]}
      bullets={[
        'cabecera del colaborador',
        'tabs por sección',
        'card de PIN con reset',
        'historial reciente',
      ]}
    />
  )
}
