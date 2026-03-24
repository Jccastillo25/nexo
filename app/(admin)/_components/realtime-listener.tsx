'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export function RealtimeListener() {
  const router = useRouter()

  useEffect(() => {
    const supabase = createClient()

    // Suscribirse a cambios en la tabla attendance_logs
    const channel = supabase
      .channel('public:attendance_logs')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'attendance_logs' },
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
