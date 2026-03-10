import { ModulePlaceholder } from '../../_components/module-placeholder'

export default function Page() {
  return (
    <ModulePlaceholder
      title="Incidencias"
      description="Seguimiento de tardanzas, ausencias, marcaciones incompletas y eventos fuera de turno."
      stats={[
        { label: 'Abiertas', value: '13' },
        { label: 'Tardanzas', value: '6' },
        { label: 'Ausencias', value: '3' },
        { label: 'Fuera de turno', value: '4' },
      ]}
      bullets={[
        'badges por severidad',
        'filtros por tipo',
        'resumen diario',
        'acciones de revisión',
      ]}
    />
  )
}
