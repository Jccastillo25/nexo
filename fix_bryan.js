const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf8');
const obj = env.split('\n').reduce((acc, line) => {
  const [key, ...rest] = line.split('=');
  if(key) acc[key.trim()] = rest.join('=').trim();
  return acc;
}, {});

const supabaseUrl = obj.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = obj.SUPABASE_SERVICE_ROLE_KEY;

async function run() {
  // Update Bryan's last record (clock_in at 21:39 UTC / 15:39 Local)
  // Shift 07:30. Tardiness = (15*60+39) - (7*60+30) = 489
  const res = await fetch(`${supabaseUrl}/rest/v1/time_records?id=eq.eb133986-e1be-41d0-b449-65a4c2379c2a`, {
    method: 'PATCH',
    headers: { 
      'apikey': supabaseKey, 
      'Authorization': `Bearer ${supabaseKey}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal'
    },
    body: JSON.stringify({ tardiness_minutes: 489 })
  });
  console.log('Update status:', res.status);
}
run();
