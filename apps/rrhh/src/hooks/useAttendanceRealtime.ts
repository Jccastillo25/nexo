'use client'

import { useEffect, useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'

const EMPLOYEE_SELECT = `
  id, first_name, last_name, email, phone, photo_url,
  employee_code, is_active, job_position_id, current_status,
  company_id, branch_id, last_status_change,
  job_positions(id, name, level, parent_id)
`

export function useAttendanceRealtime(companyId: string) {
  const [employees, setEmployees] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Memoize the client so it is not re-created on every render
  const supabase = useMemo(() => createClient(), [])

  useEffect(() => {
    if (!companyId) return

    let cancelled = false

    // 1. Initial Fetch
    const fetchEmployees = async () => {
      const { data, error } = await supabase
        .from('employees')
        .select(EMPLOYEE_SELECT)
        .eq('company_id', companyId)
        .eq('is_active', true)
        .order('last_status_change', { ascending: false })

      if (!cancelled) {
        if (!error && data) setEmployees(data)
        setIsLoading(false)
      }
    }

    // Fetch a single employee by id (used when INSERT arrives via realtime)
    const fetchOneEmployee = async (id: string) => {
      const { data } = await supabase
        .from('employees')
        .select(EMPLOYEE_SELECT)
        .eq('id', id)
        .single()

      if (!cancelled && data) {
        setEmployees((prev) => {
          const exists = prev.some((e) => e.id === id)
          return exists ? prev.map((e) => (e.id === id ? data : e)) : [...prev, data]
        })
      }
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
            // Realtime payload.new does NOT include joined relations (e.g. job_positions).
            // Merge only known scalar fields to preserve existing join data.
            setEmployees((prev) =>
              prev.map((emp) =>
                emp.id === payload.new.id
                  ? {
                      ...emp,
                      current_status: payload.new.current_status,
                      last_status_change: payload.new.last_status_change,
                      is_active: payload.new.is_active,
                      first_name: payload.new.first_name,
                      last_name: payload.new.last_name,
                      photo_url: payload.new.photo_url,
                      branch_id: payload.new.branch_id,
                      job_position_id: payload.new.job_position_id,
                    }
                  : emp
              )
            )
          } else if (payload.eventType === 'INSERT') {
            // Fetch the full record (with joins) for the new employee
            fetchOneEmployee(payload.new.id)
          } else if (payload.eventType === 'DELETE') {
            setEmployees((prev) => prev.filter((emp) => emp.id !== payload.old.id))
          }
        }
      )
      .subscribe()

    return () => {
      cancelled = true
      supabase.removeChannel(channel)
    }
  }, [companyId, supabase])

  return { employees, isLoading }
}
