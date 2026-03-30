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
      { href: '/contracts', label: 'Gestión Contractual' },
    ],
  },
  {
    title: 'Gestión de Turnos',
    items: [
      { href: '/schedules/templates', label: 'Catálogo de Turnos' },
      { href: '/attendance/records', label: 'Asistencia Diaria' },
      { href: '/leave', label: 'Permisos y Ausencias' },
    ],
  },
  {
    title: 'Nómina y Cierres',
    items: [
      { href: '/reports', label: 'Hub de Reportes Legales' },
    ],
  },
  {
    title: 'Configuración',
    items: [
      { href: '/organization', label: 'Estructura Orgánica' },
      { href: '/security', label: 'Usuarios y Permisos' },
      { href: '/settings', label: 'Configuración General' },
      { href: '/kiosk/devices', label: 'Red de Kioskos (Hardware)' },
    ],
  },
]
