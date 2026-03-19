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
    items: [
      { href: '/employees', label: 'Directorio' },
      { href: '/employees/new?fast=true', label: 'Altas Rápidas' },
      { href: '/employees/groups', label: 'Grupos/Equipos' },
      { href: '/employees/documents', label: 'Documentos' },
      { href: '/employees/kiosk-settings', label: 'Configuración de Kiosko' },
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
    title: 'Contrataciones',
    items: [
      { href: '/contracts', label: 'Dashboard' },
      { href: '/contracts/new', label: 'Nueva contratación' },
      { href: '/contracts/templates', label: 'Plantillas' },
    ],
  },
  {
    title: 'Horarios',
    items: [
      { href: '/schedules', label: 'Turnos' },
      { href: '/schedules/new', label: 'Crear Turno' },
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
  {
    title: 'Kiosko',
    items: [
      { href: '/kiosk/message', label: 'Mensaje del Kiosco' },
      { href: '/kiosk/devices', label: 'Dispositivos Kiosko' },
      { href: '/kiosk/settings', label: 'Configuración Kioscos' },
      { href: '/kiosk/assign', label: 'Asignar Kiosko' },
    ],
  },
]
