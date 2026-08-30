'use client'

import { useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { fetchComplianceStats } from '@/app/actions/compliance'

export function DashboardNotifications({ companyId }: { companyId: string | null }) {
  const hasNotified = useRef(false)

  useEffect(() => {
    if (hasNotified.current) return

    async function checkCompliance() {
      try {
        const stats = await fetchComplianceStats(companyId || undefined)
        if (stats.expiredCount > 0) {
          toast.error('Resumen de Riesgo', {
            description: `Se detectaron ${stats.expiredCount} vencimientos de INSS. Por favor, revise el panel de cumplimiento.`,
            duration: 8000,
            icon: <div className="size-2 bg-red-500 rounded-full animate-pulse" />
          })
          hasNotified.current = true
        }
      } catch (error) {
        console.error("Error checking compliance for notification", error)
      }
    }

    checkCompliance()
  }, [companyId])

  return null
}
