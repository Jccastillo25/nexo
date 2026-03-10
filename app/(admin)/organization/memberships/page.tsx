import { ModulePlaceholder } from '../../_components/module-placeholder'

export default function Page() {
  return (
    <ModulePlaceholder
      title="Membresías"
      description="Relación entre usuarios, empresa, rol y sucursal."
      stats={[
        { label: 'Usuarios admin', value: '7' },
        { label: 'RRHH', value: '3' },
        { label: 'Supervisores', value: '5' },
        { label: 'Viewers', value: '3' },
      ]}
      bullets={[
        'tabla de accesos',
        'filtros por rol',
        'estado activo',
        'acciones de gestión',
      ]}
    />
  )
}
