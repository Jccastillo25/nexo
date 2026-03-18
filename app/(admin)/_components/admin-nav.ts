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
    title: 'Dashboard',
    direct: true,
    items: [
      { href: '/dashboard', label: 'Dashboard' },
    ],
  },
  {
    title: 'Empleados',
    direct: true,
    items: [
      { href: '/employees', label: 'Empleados' },
    ],
  },
  {
    title: 'Marcaciones',
    items: [
      { href: '/attendance', label: 'Resumen' },
      { href: '/attendance/records', label: 'Registros' },
      { href: '/attendance/corrections', label: 'Correcciones' },
      { href: '/attendance/incidents', label: 'Incidencias' },
    ],
  },
  {
    title: 'Horarios',
    items: [
      { href: '/schedules', label: 'Turnos' },
      { href: '/schedules/assignments', label: 'Asignaciones' },
    ],
  },
  {
    title: 'Aprobaciones',
    direct: true,
    items: [
      { href: '/leave', label: 'Permisos y ausencias' },
    ],
  },
  {
    title: 'Reportes',
    items: [
      { href: '/reports', label: 'General' },
      { href: '/reports/attendance', label: 'Asistencia' },
      { href: '/reports/hours', label: 'Horas trabajadas' },
      { href: '/reports/incidents', label: 'Incidencias' },
    ],
  },
  {
    title: 'Organización',
    items: [
      { href: '/organization', label: 'General' },
      { href: '/organization/companies', label: 'Empresas' },
      { href: '/organization/branches', label: 'Sucursales' },
      { href: '/organization/kiosks', label: 'Kioskos' },
      { href: '/organization/memberships', label: 'Membresías' },
    ],
  },
  {
    title: 'Sistema',
    items: [
      { href: '/security', label: 'Seguridad' },
      { href: '/settings', label: 'Configuración' },
    ],
  },
]
