'use server'

import { createClient } from '@/lib/supabase/server'

export type PendingInssEmployee = {
  id: string
  first_name: string
  last_name: string
  branch_id: string
  hire_date: string
  inss_grace_expiry: string
  company_id: string
}

export type ComplianceStats = {
  totalEmployees: number
  expiredInssCount: number
  // Aliases for compatibility with existing UI
  totalActive: number
  expiredCount: number
}

/**
 * Fetches compliance statistics for the legal center.
 * Accessible to any authorized member to show high-level summary.
 */
export async function fetchComplianceStats(companyId?: string): Promise<ComplianceStats> {
  const supabase = await createClient()
  const today = new Date().toISOString().split('T')[0]

  let totalQuery = supabase
    .from('employees')
    .select('id', { count: 'exact', head: true })
    .eq('is_active', true)

  let expiredQuery = supabase
    .from('employees')
    .select('id', { count: 'exact', head: true })
    .eq('inss_status', 'PENDING_GRACE')
    .lt('inss_grace_expiry', today)

  if (companyId && companyId !== 'all') {
    totalQuery = totalQuery.eq('company_id', companyId)
    expiredQuery = expiredQuery.eq('company_id', companyId)
  }

  const [totalRes, expiredRes] = await Promise.all([totalQuery, expiredQuery])

  const total = totalRes.count || 0
  const expired = expiredRes.count || 0

  return {
    totalEmployees: total,
    expiredInssCount: expired,
    totalActive: total,
    expiredCount: expired
  }
}

/**
 * Fetches detailed list of employees with expired grace periods.
 * RESTRICTED: Only Admin, Owner, or RRHH can access this data.
 */
export async function fetchPendingInss(companyId?: string): Promise<PendingInssEmployee[]> {
  const supabase = await createClient()
  
  // Security check: Verify user role
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data: membership } = await supabase
    .from('company_memberships')
    .select('role')
    .eq('profile_id', user.id) // Corrected from user_id based on typical schema
    .single()

  const role = membership?.role?.toLowerCase()
  if (!['admin', 'owner', 'rrhh'].includes(role || '')) {
    console.warn(`Unauthorized access attempt to detailed INSS data by user ${user.id}`)
    return []
  }

  const today = new Date().toISOString().split('T')[0]

  let query = supabase
    .from('employees')
    .select('id, first_name, last_name, branch_id, hire_date, inss_grace_expiry, company_id')
    .eq('inss_status', 'PENDING_GRACE')
    .lt('inss_grace_expiry', today)

  if (companyId && companyId !== 'all') {
    query = query.eq('company_id', companyId)
  }

  const { data, error } = await query.order('inss_grace_expiry', { ascending: true })

  if (error) {
    console.error('Failed to fetch pending INSS:', error)
    return []
  }

  return (data || []) as PendingInssEmployee[]
}
