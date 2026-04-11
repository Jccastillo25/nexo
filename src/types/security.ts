// Gestor360 — Norma de Permisos v2.0.0
// Toda propiedad aquí debe tener su columna en user_permissions (DB)
// y su entrada en permissions-manifest.json y PermissionsMatrix (UI).

export interface UserPermissions {
  profile_id: string
  company_id: string

  // ─── Centro de Control ────────────────────────────────────────────────────
  can_view_kpis_talent:     boolean
  can_view_kpis_attendance: boolean
  can_view_kpis_financial:  boolean
  can_view_kpis_hardware:   boolean
  can_manage_kiosks:        boolean

  // ─── Talento ──────────────────────────────────────────────────────────────
  can_view_employees:       boolean
  can_manage_employees:     boolean
  can_view_contracts:       boolean
  can_manage_contracts:     boolean

  // ─── Turnos ───────────────────────────────────────────────────────────────
  can_view_shift_templates:   boolean
  can_manage_shift_templates: boolean
  can_manage_schedules:       boolean

  // ─── Asistencia ───────────────────────────────────────────────────────────
  can_view_attendance:      boolean
  can_manage_attendance:    boolean
  can_approve_corrections:  boolean
  can_manage_leaves:        boolean

  // ─── Nómina ───────────────────────────────────────────────────────────────
  can_view_reports:  boolean
  can_view_payroll:  boolean
  can_manage_payroll: boolean
  can_view_salary:   boolean

  // ─── Sistema ──────────────────────────────────────────────────────────────
  can_manage_company:  boolean
  can_manage_settings: boolean
  can_manage_users:    boolean
  can_manage_roles:    boolean
  can_view_audit_logs: boolean
  can_impersonate:     boolean

  updated_at: string
}

export type PermissionKey = keyof Omit<UserPermissions, 'profile_id' | 'company_id' | 'updated_at'>

export type UserRole = 'owner' | 'admin' | 'rrhh' | 'supervisor' | 'viewer'
