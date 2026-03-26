'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { AlertCircle, CheckCircle2, Loader2, Play } from 'lucide-react'

interface IntegrityScannerProps {
  start: string
  end: string
  branchId?: string
  onValidated: (isValid: boolean) => void
}

export function IntegrityScanner({ start, end, branchId, onValidated }: IntegrityScannerProps) {
  const [status, setStatus] = useState<'idle' | 'scanning' | 'ready' | 'error'>('idle')
  const [issues, setIssues] = useState<any[]>([])
  const supabase = createClient()

  async function runScan() {
    setStatus('scanning')
    onValidated(false)
    
    try {
      // We query the consolidated view for missing_clock_out
      let query = supabase
        .from('consolidated_attendance_view')
        .select('*')
        .gte('attendance_date', start)
        .lte('attendance_date', end)

      if (branchId && branchId !== 'all') {
        query = query.eq('branch_id', branchId)
      }

      const { data, error } = await query
      if (error) throw error

      const integrityIssues = data?.filter(r => r.missing_clock_out) || []
      setIssues(integrityIssues)
      
      if (integrityIssues.length === 0) {
        setStatus('ready')
        onValidated(true)
      } else {
        setStatus('error')
        onValidated(false)
      }
    } catch (err) {
      console.error(err)
      setStatus('error')
    }
  }

  // Auto-scan when params change
  useEffect(() => {
    runScan()
  }, [start, end, branchId])

  return (
    <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4 transition-all">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {status === 'scanning' && <Loader2 className="h-5 w-5 animate-spin text-slate-400" />}
          {status === 'ready' && <CheckCircle2 className="h-5 w-5 text-emerald-500" />}
          {status === 'error' && <AlertCircle className="h-5 w-5 text-amber-500" />}
          {status === 'idle' && <Play className="h-5 w-5 text-slate-400" />}
          
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              {status === 'scanning' ? 'Escaneando integridad...' : 
               status === 'ready' ? 'Datos íntegros para reporte' : 
               status === 'error' ? 'Inconsistencias detectadas' : 'Listo para escanear'}
            </h3>
            <p className="text-xs text-slate-500">
              {status === 'error' ? `${issues.length} marcaciones incompletas bloquean la exportación.` : 
               status === 'ready' ? 'Todos los registros tienen entrada y salida.' : 
               'Se requiere validación antes de generar PDF.'}
            </p>
          </div>
        </div>

        {status === 'error' && (
          <button 
            onClick={() => runScan()}
            className="text-xs font-bold text-slate-900 underline underline-offset-4"
          >
            Re-escaneas
          </button>
        )}
      </div>

      {issues.length > 0 && (
        <div className="mt-4 max-h-32 overflow-y-auto rounded-2xl border border-amber-100 bg-amber-50/50 p-3">
          <ul className="space-y-2">
            {issues.map((issue, idx) => (
              <li key={idx} className="flex justify-between text-[10px] text-amber-800">
                <span className="font-bold">{issue.full_name}</span>
                <span>{issue.attendance_date} (Falta Salida)</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
