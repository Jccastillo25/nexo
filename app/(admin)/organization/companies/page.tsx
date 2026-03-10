import { ModulePlaceholder } from '../../_components/module-placeholder'

export default function Page() {
  return (
    <ModulePlaceholder
      title="Empresas"
      description="Administración visual de empresas y parámetros base del tenant."
      stats={[
        { label: 'Empresas activas', value: '2' },
        { label: 'En onboarding', value: '1' },
        { label: 'Con alertas', value: '0' },
        { label: 'Moneda base', value: 'C$ / USD' },
      ]}
      bullets={[
        'tabla de empresas',
        'configuración general',
        'estado del tenant',
        'acciones por fila',
      ]}
    />
  )
}
