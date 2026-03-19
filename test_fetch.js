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
  const res = await fetch(`${supabaseUrl}/rest/v1/employees?select=id,first_name,last_name,contracts(status,schedule_id,shifts(*)),employee_shifts(*)&first_name=ilike.*Bryan*`, {
    headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
  });
  console.log('--- Bryan query result ---');
  console.log(JSON.stringify(await res.json(), null, 2));
}
run();
