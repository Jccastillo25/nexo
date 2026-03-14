import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
)

async function run() {
  console.log('--- Verificando Tablas de Horarios ---')
  
  const { data: tables, error: e1 } = await supabase.rpc('get_tables'); // Si existe tal RPC
  if (e1) {
    // Intento alternativo consultando una fila
    const { data: shifts, error: sError } = await supabase.from('shifts').select('*').limit(1)
    if (sError) {
      console.log('Tabla shifts no encontrada o sin acceso:', sError.message)
    } else {
      console.log('Tabla shifts encontrada. Columnas:', Object.keys(shifts[0] || {}))
    }

    const { data: eShifts, error: esError } = await supabase.from('employee_shifts').select('*').limit(1)
    if (esError) {
      console.log('Tabla employee_shifts no encontrada o sin acceso:', esError.message)
    } else {
      console.log('Tabla employee_shifts encontrada. Columnas:', Object.keys(eShifts[0] || {}))
    }
  }
}

run()
