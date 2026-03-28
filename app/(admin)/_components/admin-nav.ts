export type NavItem = {
  href: string
  label: string
}

export type NavSection = {
  title: string
  /** If true this section renders as a single direct link (no children) */
  direct?: boolean
  items: NavItem[]
}

export const adminNav: NavSection[] = [
  {
    title: 'Centro de Control',
    items: [
      { href: '/dashboard', label: 'Dashboard (Métricas)' },
      { href: '/monitor', label: 'Monitor 360° (Operación)' }
    ],
  },
  {
    title: 'Gestión de Talento',
    items: [
      { href: '/employees', label: 'Directorio (Expediente)' },
      { href: '/employees/groups', label: 'Puestos de Trabajo' },
      { href: '/contracts', label: 'Gestión Contractual' },
    ],
  },
  {
    title: 'Gestión de Turnos',
    items: [
      { href: '/schedules/global-planning', label: 'Planilla Maestra' },
      { href: '/attendance/records', label: 'Asistencia Diaria' },
      { href: '/leave', label: 'Permisos y Ausencias' },
    ],
  },
  {
    title: 'Nómina y Cierres',
    items: [
      { href: '/reports', label: 'Hub de Reportes Legales' },
      { href: '/security', label: 'Auditoría / Sistema' },
    ],
  },
  {
    title: 'Configuración',
    items: [
      { href: '/organization', label: 'Estructura Orgánica' },
      { href: '/kiosk/devices', label: 'Red de Kioskos (Hardware)' },
      { href: '/settings', label: 'Seguridad / Roles' },
    ],
  },
]
