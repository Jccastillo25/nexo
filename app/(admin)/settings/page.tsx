import { ModulePlaceholder } from '../_components/module-placeholder'

export default function Page() {
  return (
    <ModulePlaceholder
      title="Configuración"
      description="Parámetros generales del sistema, preferencias y opciones del tenant."
      stats={[
        { label: 'Zona horaria', value: 'America/Managua' },
        { label: 'Parámetros activos', value: '18' },
        { label: 'Última edición', value: 'Hoy' },
        { label: 'Estado', value: 'Operativo' },
      ]}
      bullets={[
        'preferencias generales',
        'ajustes del tenant',
        'parámetros de asistencia',
        'auditoría de cambios',
      ]}
    />
  )
}
