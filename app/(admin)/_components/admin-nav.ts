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
      { href: '/dashboard', label: 'Dashboard' },
      { href: '/monitor', label: 'Monitor 360°' }
    ],
  },
  {
    title: 'Gestión de Talento',
    items: [
      { href: '/employees', label: 'Directorio Maestro' },
      { href: '/contracts', label: 'Gestión Contractual' },
      { href: '/employees/groups', label: 'Estructura Corporativa' },
    ],
  },
  {
    title: 'Tiempo y Asistencia',
    items: [
      { href: '/attendance/records', label: 'Registro Maestro (CRUD)' },
      { href: '/schedules', label: 'Planificación (Turnos)' },
      { href: '/leave', label: 'Permisos y Ausencias' },
    ],
  },
  {
    title: 'Nómina y Cierres',
    items: [
      { href: '/reports/hours', label: 'Pre-nómina (Cálculos)' },
      { href: '/reports/attendance', label: 'Histórico de Cierres' },
    ],
  },
  {
    title: 'Configuración',
    items: [
      { href: '/organization', label: 'Organización (Empresa/Sucursal)' },
      { href: '/kiosk/devices', label: 'Red de Kioskos (Hardware)' },
      { href: '/security', label: 'Seguridad (Roles/Auditoría)' },
    ],
  },
]
