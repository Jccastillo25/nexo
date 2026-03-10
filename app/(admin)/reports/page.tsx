import { ModulePlaceholder } from '../_components/module-placeholder'

export default function Page() {
  return (
    <ModulePlaceholder
      title="Reportes"
      description="Centro visual de reportes para asistencia, tardanzas, horas trabajadas y exportaciones."
      stats={[
        { label: 'Reportes disponibles', value: '6' },
        { label: 'Exportaciones hoy', value: '9' },
        { label: 'Último cierre', value: '08:40' },
        { label: 'Formatos', value: 'PDF / Excel' },
      ]}
      bullets={[
        'tarjetas por reporte',
        'resumen general',
        'filtros avanzados',
        'exportaciones',
      ]}
    />
  )
}
