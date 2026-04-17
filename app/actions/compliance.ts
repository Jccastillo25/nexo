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

export async function fetchPendingInss(companyId?: string): Promise<PendingInssEmployee[]> {
  const supabase = await createClient()
  
  // Security check: Only Admin and RRHH can see detailed INSS data
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data: membership } = await supabase
    .from('company_memberships')
    .select('role')
    .eq('user_id', user.id)
    .single()

  const role = membership?.role?.toLowerCase()
  if (!['admin', 'owner', 'rrhh'].includes(role || '')) {
    console.warn(`Unauthorized access attempt to detailed INSS data by user ${user.id} with role ${role}`)
    return []
  }

  // Format today's date logically based on local timezone
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

export type ComplianceStats = {
  totalActive: number
  expiredCount: number
}

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

  return {
    totalActive: totalRes.count || 0,
    expiredCount: expiredRes.count || 0
  }
}
