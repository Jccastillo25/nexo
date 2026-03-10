import { ModulePlaceholder } from '../../_components/module-placeholder'

export default function Page() {
  return (
    <ModulePlaceholder
      title="Sucursales"
      description="Control de sucursales, ubicación, kiosko asignado y estado operativo."
      stats={[
        { label: 'Sucursales activas', value: '4' },
        { label: 'Con kiosko', value: '4' },
        { label: 'Fuera de línea', value: '0' },
        { label: 'Pendientes revisión', value: '1' },
      ]}
      bullets={[
        'tabla por sucursal',
        'estado de kiosko',
        'ubicación',
        'acciones rápidas',
      ]}
    />
  )
}
