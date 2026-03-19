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
  const res = await fetch(`${supabaseUrl}/rest/v1/time_records?select=id,recorded_at,tardiness_minutes,employees(first_name,last_name)&order=recorded_at.desc&limit=5`, {
    headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
  });
  const data = await res.json();
  console.log('--- Latest 5 records ---');
  console.log(JSON.stringify(data, null, 2));
}
run();
