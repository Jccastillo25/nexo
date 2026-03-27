const URL = 'https://ofeuzkwjhmfsazqfyutu.supabase.co/rest/v1'
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9mZXV6k3dqaG1mc2F6cWZ5dXR1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzAzMDIwOSwiZXhwIjoyMDg4NjA2MjA5fQ.YSwvkWvgglrl3J1KYdCYpZtrEe7VXJIFplxMfM479TM'

async function check() {
  const headers = {
    'apikey': KEY,
    'Authorization': `Bearer ${KEY}`
  }

  try {
    const resTr = await fetch(`${URL}/time_records?select=recorded_at,employee_id,event_type&order=recorded_at.desc&limit=20`, { headers })
    const jsonTr = await resTr.json()
    console.log('\n--- LAST 20 time_records ---')
    console.table(jsonTr)

    const resAl = await fetch(`${URL}/attendance_logs?select=clock_in,clock_out,employee_id&order=clock_in.desc&limit=20`, { headers })
    const jsonAl = await resAl.json()
    console.log('\n--- LAST 20 attendance_logs ---')
    console.table(jsonAl)

  } catch (e) {
    console.error('Error:', e)
  }
}

check()
