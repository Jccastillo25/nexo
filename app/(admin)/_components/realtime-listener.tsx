'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export function RealtimeListener() {
  const router = useRouter()

  useEffect(() => {
    const supabase = createClient()

    // Suscribirse a INSERTS en la tabla time_records
    const channel = supabase
      .channel('public:time_records')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'time_records' },
        (payload) => {
          console.log('Realtime Event received:', payload)
          // Refresca la ruta actual en el servidor
          router.refresh()
        }
      )
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR') {
          console.error('Realtime channel error — retrying connection')
        }
      })

    return () => {
      supabase.removeChannel(channel)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return null
}
