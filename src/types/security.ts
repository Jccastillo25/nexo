export interface UserPermissions {
  profile_id: string;
  company_id: string;
  
  // Talento
  can_view_employees: boolean;
  can_manage_employees: boolean;
  can_view_contracts: boolean;
  can_manage_contracts: boolean;
  
  // Turnos
  can_view_shift_templates: boolean;
  can_manage_shift_templates: boolean;
  can_manage_schedules: boolean;
  
  // Asistencia
  can_view_attendance: boolean;
  can_manage_attendance: boolean;
  can_approve_corrections: boolean;
  can_manage_leaves: boolean;
  
  // Nómina
  can_view_payroll: boolean;
  can_manage_payroll: boolean;
  can_view_salary: boolean;
  
  // Sistema
  can_manage_users: boolean;
  can_manage_roles: boolean;
  can_view_audit_logs: boolean;
  can_impersonate: boolean;
  
  updated_at: string;
}
