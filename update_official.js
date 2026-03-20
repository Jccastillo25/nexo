const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf8');
const obj = env.split('\n').reduce((acc, line) => {
  const [key, ...rest] = line.split('=');
  if(key) acc[key.trim()] = rest.join('=').trim();
  return acc;
}, {});

const supabaseUrl = obj.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = obj.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const id = 'eb133986-e1be-41d0-b449-65a4c2379c2a';
  
  const { data, error } = await supabase
    .from('time_records')
    .update({ tardiness_minutes: 489 })
    .eq('id', id)
    .select();

  console.log('Update result:', data, 'Error:', error);
}
run();
