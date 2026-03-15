
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import path from 'path'

// Cargar variables de entorno del archivo .env.local de Next.js
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('Faltan variables de entorno Supabase.')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function testColumns() {
  const { data, error } = await supabase
    .from('employees')
    .select('*')
    .limit(1)

  if (error) {
    console.error('Error al consultar empleados:', error.message)
    
    // Intentar una por una las columnas sospechosas
    const suspects = [
      'photo_url', 'national_id', 'social_security_id', 
      'tax_id', 'birth_date', 'gender', 'address'
    ]
    
    for (const col of suspects) {
      const { error: colError } = await supabase.from('employees').select(col).limit(1)
      if (colError) {
        console.log(`❌ Columna faltante: ${col}`)
      } else {
        console.log(`✅ Columna existente: ${col}`)
      }
    }
  } else {
    console.log('✅ Todas las columnas parecen existir.')
    if (data && data.length > 0) {
      console.log('Columnas encontradas:', Object.keys(data[0]).join(', '))
    }
  }
}

testColumns()
