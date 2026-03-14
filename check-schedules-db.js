const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
)

async function run() {
  console.log('--- Verificando Tablas de Horarios ---')
  
  // Intento consultando una fila
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

run()
