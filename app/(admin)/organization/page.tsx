import { ModulePlaceholder } from '../_components/module-placeholder'

export default function Page() {
  return (
    <ModulePlaceholder
      title="Organización"
      description="Vista general de la estructura multiempresa, sucursales y membresías."
      stats={[
        { label: 'Empresas', value: '2' },
        { label: 'Sucursales', value: '4' },
        { label: 'Admins', value: '7' },
        { label: 'Viewers', value: '3' },
      ]}
      bullets={[
        'resumen por entidad',
        'navegación interna',
        'estadísticas rápidas',
        'acciones de administración',
      ]}
    />
  )
}
