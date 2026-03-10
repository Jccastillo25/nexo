import { ModulePlaceholder } from ../../_components/module-placeholder'

export default function Page() {
  return (
    <ModulePlaceholder
      title="Sucursales"
      description="Control de sucursales, ubicación, kiosko asignado y estado operativo."
      stats=[{"{ label: 'Sucursales activas', value: '4' },\n        { label: 'Con kiosko', value: '4' },\n        { label: 'Fuera de línea', value: '0' },\n        { label: 'Pendientes revisión', value: '1' }"}]
      bullets=[{"'tabla por sucursal',\n        'estado de kiosko',\n        'ubicación',\n        'acciones rápidas'"}]
    />
  )
}
