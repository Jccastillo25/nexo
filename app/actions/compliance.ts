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
