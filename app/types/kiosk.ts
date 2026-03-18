export type EventType = 'clock_in' | 'clock_out' | 'break_in' | 'break_out'

export type UIState = 'idle' | 'loading' | 'selecting_action' | 'success' | 'error' | 'linking'

export interface KioskDevice {
  id: string
  branch_id: string
  device_code: string
  branch_name: string
  company_name: string
  logo_url: string | null
}

export interface KioskClientProps {
  initialLogoUrl: string | null
  initialKioskBgUrl: string | null
  initialCompanyName: string
  initialCustomMessage: string
  initialBranchId?: string | null
}

export type KioskResult =
  | { success: true; employee_name: string; employee_code: string; event_type: EventType; tardiness_minutes: number; overtime_minutes: number }
  | { success: false; error: string }
