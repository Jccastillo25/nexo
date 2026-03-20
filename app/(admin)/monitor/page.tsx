import { createClient } from '@/lib/supabase/server'
import { OperationalMonitor } from './monitor-client'
import { getNicaRange } from '../../../src/lib/date-utils'

export default async function MonitorPage() {
  const supabase = await createClient()

  // 1. Fetch all companies for selection (if supervisor has access to multiple)
  const { data: companies } = await supabase.from('companies').select('id, display_name').eq('is_active', true)

  // 2. Fetch job positions to build the hierarchy tree
  const { data: positions } = await supabase.from('job_positions').select('*').eq('is_active', true).order('level', { ascending: true })

  // 3. Fetch employees with their current status and job position
  const { data: employees } = await supabase
    .from('employees')
    .select('id, first_name, last_name, current_status, last_status_change, job_position_id, photo_url')
    .eq('is_active', true)

  // 4. Fetch active status logs for breaks in progress
  const { data: activeLogs } = await supabase
    .from('employee_status_logs')
    .select('*')
    .is('end_time_actual', null)

  return (
    <div className="space-y-6">
      <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <h1 className="text-2xl font-bold text-slate-900">Monitor Operativo Real-Time</h1>
        <p className="text-sm text-slate-500">Visualización en vivo de la jerarquía y estados de descanso.</p>
      </div>

      <OperationalMonitor 
        initialEmployees={employees || []}
        initialPositions={positions || []}
        initialLogs={activeLogs || []}
        companies={companies || []}
      />
    </div>
  )
}
