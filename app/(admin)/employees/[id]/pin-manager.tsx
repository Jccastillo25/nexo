'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { resetEmployeePin } from '../../../actions/pins'

export function PinManager({ 
  employeeId, 
  currentPin,
  hasActiveContract,
  employeeNumber
}: { 
  employeeId: string; 
  currentPin: string;
  hasActiveContract: boolean;
  employeeNumber?: string | null;
}) {
  const router = useRouter()
  const [isVisible, setIsVisible] = useState(false)
  const [isResetting, setIsResetting] = useState(false)

  const canGeneratePin = hasActiveContract && !!employeeNumber

  const handleReset = async () => {
    if (!canGeneratePin) return
    if (!confirm('¿Estás seguro de generar un nuevo PIN aleatorio para este empleado? El kiosko requerirá el nuevo código inmediatamente.')) return

    setIsResetting(true)
    const res = await resetEmployeePin(employeeId)
    setIsResetting(false)
    
    if (res?.error) {
       alert('Error: ' + res.error)
    } else {
       setIsVisible(true) // Mostramos el nuevo PIN
       router.refresh()    // Forzamos actualización de props del servidor
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {!canGeneratePin && (
        <div className="rounded-2xl bg-amber-50 p-4 text-sm text-amber-800 ring-1 ring-amber-200">
          <p className="font-semibold">⚠️ Requiere Contrato Activo</p>
          <p className="mt-1">Para generar un PIN de marcación, el colaborador debe tener un contrato vigente y un número de empleado asignado.</p>
        </div>
      )}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-slate-900">PIN de Kiosko</p>
          <div className="mt-1 flex items-center gap-3">
            <span className="font-mono text-2xl tracking-widest text-slate-700">
              {isVisible ? currentPin : '••••'}
            </span>
            <button
              type="button"
              onClick={() => setIsVisible(!isVisible)}
              className="text-sm text-blue-600 hover:text-blue-800 font-medium"
            >
              {isVisible ? 'Ocultar' : 'Mostrar'}
            </button>
          </div>
          <p className="mt-2 text-xs text-slate-500 max-w-sm">
            Este es el código seguro de 4 dígitos que usa el colaborador para registrar asistencia.
          </p>
        </div>

        <button
          type="button"
          onClick={handleReset}
          disabled={isResetting || !canGeneratePin}
          className="shrink-0 rounded-2xl bg-slate-100 px-5 py-2.5 text-sm font-semibold text-slate-900 transition hover:bg-slate-200 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {isResetting ? 'Generando...' : 'Generar nuevo código'}
        </button>
      </div>
    </div>
  )
}
