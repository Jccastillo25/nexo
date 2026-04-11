import type { PermissionKey } from '@/types/security'

export type NavItem = {
  href: string
  label: string
  permission?: PermissionKey   // Si está definido, solo se muestra si el usuario tiene este permiso
}

export type NavSection = {
  title: string
  /** Si es true, se renderiza como enlace directo (sin hijos) */
  direct?: boolean
  items: NavItem[]
  /** Permiso mínimo para mostrar toda la sección. Si no se define, siempre se muestra. */
  permission?: PermissionKey
}

export const adminNav: NavSection[] = [
  {
    title: 'Centro de Control',
    items: [
      { href: '/dashboard', label: 'Dashboard (Métricas)' },
      { href: '/monitor',   label: 'Monitor 360° (Operación)', permission: 'can_view_attendance' },
    ],
  },
  {
    title: 'Gestión de Talento',
    permission: 'can_view_employees',
    items: [
      { href: '/employees', label: 'Directorio (Expediente)',  permission: 'can_view_employees' },
      { href: '/contracts', label: 'Gestión Contractual',      permission: 'can_view_contracts'  },
    ],
  },
  {
    title: 'Gestión de Turnos',
    items: [
      { href: '/schedules/templates', label: 'Catálogo de Turnos',    permission: 'can_view_shift_templates' },
      { href: '/attendance/records',  label: 'Asistencia Diaria',     permission: 'can_view_attendance'      },
      { href: '/leave',               label: 'Permisos y Ausencias',   permission: 'can_manage_leaves'        },
    ],
  },
  {
    title: 'Nómina y Cierres',
    permission: 'can_view_reports',
    items: [
      { href: '/reports', label: 'Hub de Reportes Legales', permission: 'can_view_reports' },
    ],
  },
  {
    title: 'Configuración',
    items: [
      { href: '/organization',  label: 'Estructura Orgánica',        permission: 'can_manage_company'  },
      { href: '/security',      label: 'Administración de Accesos',  permission: 'can_manage_users'    },
      { href: '/settings',      label: 'Configuración General',      permission: 'can_manage_settings' },
      { href: '/kiosk/devices', label: 'Red de Kioskos (Hardware)',  permission: 'can_manage_kiosks'   },
    ],
  },
]
