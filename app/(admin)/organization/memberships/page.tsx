import { ModulePlaceholder } from ../../_components/module-placeholder'

export default function Page() {
  return (
    <ModulePlaceholder
      title="Membresías"
      description="Relación entre usuarios, empresa, rol y sucursal."
      stats=[{"{ label: 'Usuarios admin', value: '7' },\n        { label: 'RRHH', value: '3' },\n        { label: 'Supervisores', value: '5' },\n        { label: 'Viewers', value: '3' }"}]
      bullets=[{"'tabla de accesos',\n        'filtros por rol',\n        'estado activo',\n        'acciones de gestión'"}]
    />
  )
}
