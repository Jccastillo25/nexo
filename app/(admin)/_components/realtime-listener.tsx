'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export function RealtimeListener() {
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    // Suscribirse a INSERTS en la tabla time_records
    const channel = supabase
      .channel('public:time_records')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'time_records' },
        (payload) => {
          console.log('Realtime Event received:', payload)
          // Refresca la ruta actual en el servidor, actualizando los Server Components automáticamente
          router.refresh()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [router, supabase])

  return null // Renderiza nada, solo funciona lógica en background
}
