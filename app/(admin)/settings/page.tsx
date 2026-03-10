import { ModulePlaceholder } from ../_components/module-placeholder'

export default function Page() {
  return (
    <ModulePlaceholder
      title="Configuración"
      description="Parámetros generales del sistema, preferencias y opciones del tenant."
      stats=[{"{ label: 'Zona horaria', value: 'America/Managua' },\n        { label: 'Parámetros activos', value: '18' },\n        { label: 'Última edición', value: 'Hoy' },\n        { label: 'Estado', value: 'Operativo' }"}]
      bullets=[{"'preferencias generales',\n        'ajustes del tenant',\n        'parámetros de asistencia',\n        'auditoría de cambios'"}]
    />
  )
}
