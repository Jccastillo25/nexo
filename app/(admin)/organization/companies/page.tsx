import { ModulePlaceholder } from ../../_components/module-placeholder'

export default function Page() {
  return (
    <ModulePlaceholder
      title="Empresas"
      description="Administración visual de empresas y parámetros base del tenant."
      stats=[{"{ label: 'Empresas activas', value: '2' },\n        { label: 'En onboarding', value: '1' },\n        { label: 'Con alertas', value: '0' },\n        { label: 'Moneda base', value: 'C$ / USD' }"}]
      bullets=[{"'tabla de empresas',\n        'configuración general',\n        'estado del tenant',\n        'acciones por fila'"}]
    />
  )
}
