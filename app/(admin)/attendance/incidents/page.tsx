import { ModulePlaceholder } from ../../_components/module-placeholder'

export default function Page() {
  return (
    <ModulePlaceholder
      title="Incidencias"
      description="Seguimiento de tardanzas, ausencias, marcaciones incompletas y eventos fuera de turno."
      stats=[{"{ label: 'Abiertas', value: '13' },\n        { label: 'Tardanzas', value: '6' },\n        { label: 'Ausencias', value: '3' },\n        { label: 'Fuera de turno', value: '4' }"}]
      bullets=[{"'badges por severidad',\n        'filtros por tipo',\n        'resumen diario',\n        'acciones de revisión'"}]
    />
  )
}
