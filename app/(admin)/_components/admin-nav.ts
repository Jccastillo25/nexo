export type NavItem = {
  href: string
  label: string
}

export type NavSection = {
  title: string
  items: NavItem[]
}

export const adminNav: NavSection[] = [
  {
    title: 'Principal',
    items: [
      { href: '/dashboard', label: 'Dashboard' },
    ],
  },
  {
    title: 'Operación',
    items: [
      { href: '/attendance', label: 'Asistencia' },
      { href: '/attendance/records', label: 'Registros' },
      { href: '/attendance/corrections', label: 'Correcciones' },
      { href: '/attendance/incidents', label: 'Incidencias' },
      { href: '/employees', label: 'Empleados' },
      { href: '/schedules', label: 'Horarios' },
      { href: '/schedules/assignments', label: 'Asignaciones' },
      { href: '/leave', label: 'Permisos y ausencias' },
      { href: '/reports', label: 'Reportes' },
    ],
  },
  {
    title: 'Estructura',
    items: [
      { href: '/organization', label: 'Organización' },
      { href: '/organization/companies', label: 'Empresas' },
      { href: '/organization/branches', label: 'Sucursales' },
      { href: '/organization/memberships', label: 'Membresías' },
      { href: '/security', label: 'Seguridad' },
      { href: '/settings', label: 'Configuración' },
    ],
  },
]
