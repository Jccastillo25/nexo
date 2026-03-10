import { ModulePlaceholder } from ../_components/module-placeholder'

export default function Page() {
  return (
    <ModulePlaceholder
      title="Organización"
      description="Vista general de la estructura multiempresa, sucursales y membresías."
      stats=[{"{ label: 'Empresas', value: '2' },\n        { label: 'Sucursales', value: '4' },\n        { label: 'Admins', value: '7' },\n        { label: 'Viewers', value: '3' }"}]
      bullets=[{"'resumen por entidad',\n        'navegación interna',\n        'estadísticas rápidas',\n        'acciones de administración'"}]
    />
  )
}
