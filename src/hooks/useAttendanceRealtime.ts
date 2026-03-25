'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export function useAttendanceRealtime(companyId: string) {
  const [employees, setEmployees] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    if (!companyId) return

    // 1. Initial Fetch
    const fetchEmployees = async () => {
      const { data, error } = await supabase
        .from('employees')
        .select(`
          id, first_name, last_name, email, phone, photo_url,
          employee_code, is_active, job_position_id, current_status,
          company_id, branch_id, last_status_change,
          job_positions(id, name, level, parent_id)
        `)
        .eq('company_id', companyId)
        .eq('is_active', true)
        .order('last_status_change', { ascending: false })

      if (!error && data) {
        setEmployees(data)
      }
      setIsLoading(false)
    }

    fetchEmployees()

    // 2. Subscribe to Realtime Changes
    const channel = supabase
      .channel(`attendance-monitor-${companyId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'employees',
          filter: `company_id=eq.${companyId}`
        },
        (payload) => {
          if (payload.eventType === 'UPDATE') {
            setEmployees((prev) =>
              prev.map((emp) =>
                emp.id === payload.new.id ? { ...emp, ...payload.new } : emp
              )
            )
          } else if (payload.eventType === 'INSERT') {
            // Refetch job position info for new employees
            fetchEmployees()
          } else if (payload.eventType === 'DELETE') {
            setEmployees((prev) => prev.filter((emp) => emp.id !== payload.old.id))
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [companyId])

  return { employees, isLoading }
}
