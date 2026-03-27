import { createClient } from 'npm:@supabase/supabase-js@2'

const supabase = createClient(
  'https://ofeuzkwjhmfsazqfyutu.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9mZXV6a3dqaG1mc2F6cWZ5dXR1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzAzMDIwOSwiZXhwIjoyMDg4NjA2MjA5fQ.YSwvkWvgglrl3J1KYdCYpZtrEe7VXJIFplxMfM479TM'
)

async function checkData() {
  const { count: trCount } = await supabase.from('time_records').select('*', { count: 'exact', head: true })
  const { count: alCount } = await supabase.from('attendance_logs').select('*', { count: 'exact', head: true })
  
  console.log('--- Database Check ---')
  console.log(`time_records: ${trCount}`)
  console.log(`attendance_logs: ${alCount}`)
  
  // Look specifically for Thursday March 20, 2026 (or recent Thursdays)
  const { data: recentTr } = await supabase.from('time_records')
    .select('recorded_at, event_type, employee_id')
    .order('recorded_at', { ascending: false })
    .limit(20)
    
  console.log('\n--- Recent time_records (Last 20) ---')
  console.table(recentTr)

  const { data: recentAl } = await supabase.from('attendance_logs')
    .select('clock_in, clock_out, employee_id')
    .order('clock_in', { ascending: false })
    .limit(20)
    
  console.log('\n--- Recent attendance_logs (Last 20) ---')
  console.table(recentAl)
}

checkData()
