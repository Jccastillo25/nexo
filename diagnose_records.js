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
  // 1. Check all records for today (March 19)
  // Nica 19th starts at UTC 06:00 (19th) and ends at UTC 05:59 (20th)
  const start = '2026-03-19T06:00:00Z';
  const end = '2026-03-20T05:59:59Z';
  
  const res = await fetch(`${supabaseUrl}/rest/v1/time_records?select=id,recorded_at,tardiness_minutes,employee_id,employees(first_name,last_name)&recorded_at=gte.${start}&recorded_at=lte.${end}`, {
    headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
  });
  const data = await res.json();
  console.log('--- All records for today (Nica 19th) ---');
  console.log(JSON.stringify(data, null, 2));
}
run();
