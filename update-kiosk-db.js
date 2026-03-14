import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function updateSchema() {
  console.log('Adding kiosk_custom_message to companies table...');
  const { error } = await supabase.rpc('execute_sql', {
    sql: `ALTER TABLE companies ADD COLUMN IF NOT EXISTS kiosk_custom_message TEXT DEFAULT 'Gracias por su puntualidad';`
  });

  if (error) {
    if (error.message.includes('permission denied')) {
        console.warn('Execute SQL RPC might not exist or permission denied. Trying conventional query if possible (not likely via client).');
    }
    console.error('Error:', error);
  } else {
    console.log('Success!');
  }
}

updateSchema();
