'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface KioskClientProps {
  logoUrl: string | null
  kioskBgUrl: string | null
  companyName: string
  branchId: string | null
  branchName: string | null
  customMessage: string
}

type EventType = 'clock_in' | 'clock_out' | 'break_in' | 'break_out'

type KioskResult =
  | { success: true; employee_name: string; employee_code: string; event_type: EventType; tardiness_minutes: number; overtime_minutes: number }
  | { success: false; error: string }

type UIState = 'idle' | 'loading' | 'selecting_action' | 'success' | 'error'

export function KioskClient({ logoUrl, kioskBgUrl, companyName, branchId, branchName, customMessage }: KioskClientProps) {
  const [pin, setPin]             = useState('')
  const [time, setTime]           = useState('')
  const [date, setDate]           = useState('')
  const [uiState, setUiState]     = useState<UIState>('idle')
  const [result, setResult]       = useState<KioskResult | null>(null)
  const resetTimer                = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Reloj en tiempo real
  useEffect(() => {
    const update = () => {
      const now = new Date()
      setTime(
        new Intl.DateTimeFormat('es-NI', {
          hour: 'numeric',
          minute: '2-digit',
          second: '2-digit',
          hour12: true,
        }).format(now)
      )
      setDate(
        new Intl.DateTimeFormat('es-NI', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
        }).format(now)
      )
    }
    update()
    const id = setInterval(update, 1000)
    return () => clearInterval(id)
  }, [])

  // Teclado físico — solo en estado idle
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (uiState !== 'idle') return
      if (e.key >= '0' && e.key <= '9') {
        addDigit(e.key)
      } else if (e.key === 'Backspace' || e.key === 'Delete') {
        setPin((prev) => prev.slice(0, -1))
      } else if (e.key === 'Escape') {
        reset()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uiState])

  const addDigit = (digit: string) => {
    if (pin.length >= 4 || uiState === 'loading') return
    setPin((prev) => prev + digit)
  }

  const clearPin = () => {
    if (uiState === 'loading') return
    setPin('')
  }

  const reset = () => {
    setPin('')
    setUiState('idle')
    setResult(null)
    if (resetTimer.current) clearTimeout(resetTimer.current)
  }

  const validatePin = async () => {
    if (pin.length !== 4 || uiState !== 'idle') return
    if (!branchId) {
      setResult({ success: false, error: 'No hay sucursal activa configurada.' })
      setUiState('error')
      resetTimer.current = setTimeout(reset, 4000)
      return
    }
    setUiState('selecting_action')
  }

  const executeAction = async (type: EventType) => {
    setUiState('loading')

    const supabase = createClient()
    const { data, error } = await supabase.rpc('kiosk_clock_event', {
      p_branch_id:  branchId,
      p_pin:        pin,
      p_event_type: type,
    })

    if (error) {
      setResult({ success: false, error: error.message })
      setUiState('error')
    } else {
      const res = data as KioskResult
      setResult(res)
      setUiState(res.success ? 'success' : 'error')
    }

    resetTimer.current = setTimeout(reset, uiState === 'error' ? 4000 : 5000)
  }

  // Auto-transition a selección cuando el PIN llega a 4 dígitos
  useEffect(() => {
    if (pin.length === 4 && uiState === 'idle') {
      validatePin()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pin])

  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9']

  const isSuccess = uiState === 'success' && result?.success
  const isError   = uiState === 'error'   || (result && !result.success)

  return (
    <main
      className="min-h-screen flex flex-col"
      style={
        kioskBgUrl
          ? { backgroundImage: `url(${kioskBgUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' }
          : { backgroundColor: '#020617' }
      }
    >
      {kioskBgUrl && <div className="absolute inset-0 bg-black/50" />}

      <div className="relative flex flex-col flex-1">

        {/* Header: Logo + Nombre del sistema */}
        <header className="flex flex-col items-center pt-5 pb-2 gap-1.5">
          {logoUrl && (
            <img src={logoUrl} alt="Logo" className="h-10 w-auto object-contain" />
          )}
          <p className="text-base font-bold tracking-wide text-white/80">{companyName}</p>
          <p className="text-[10px] font-semibold tracking-widest text-slate-500 uppercase">Sistema de Marcación</p>
        </header>

        {/* Main content */}
        <div className="flex flex-1 items-center justify-center px-4 py-2">
          <div className="w-full max-w-sm">

            {/* Clock */}
            <div className="mb-4 text-center">
              <p className="text-5xl font-bold tabular-nums text-white tracking-tight">{time}</p>
              <p className="mt-1 text-sm capitalize text-slate-400">{date}</p>
              <p className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-slate-700 bg-slate-800/80 px-3 py-1 text-xs font-semibold text-slate-400 backdrop-blur">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                {branchName ?? 'Sucursal'}
              </p>
            </div>

            {/* Card */}
            <div className="rounded-3xl bg-white p-6 shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-slate-100" />

              {/* ---- SUCCESS STATE ---- */}
              {isSuccess && result?.success && (
                <div className="flex flex-col items-center gap-3 py-3 text-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-green-100">
                    <svg className="h-7 w-7 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-slate-900">{result.employee_name}</p>
                    <p className="mt-1 text-sm font-bold text-slate-400 font-mono tracking-widest">{result.employee_code}</p>
                    <p className="mt-3 text-sm font-semibold text-green-600">
                      {result.event_type === 'clock_in' ? '✓ Turno Iniciado' :
                       result.event_type === 'clock_out' ? '✓ Turno Finalizado' :
                       result.event_type === 'break_in' ? '✓ Descanso Iniciado' : '✓ Descanso Finalizado'}
                    </p>
                  </div>
                  <p className="text-xs text-slate-400">Listo para la siguiente marcación…</p>
                </div>
              )}

              {/* ---- ERROR STATE ---- */}
              {isError && result && !result.success && (
                <div className="flex flex-col items-center gap-3 py-3 text-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-red-100">
                    <svg className="h-7 w-7 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </div>
                  <p className="text-sm font-semibold text-red-600 leading-relaxed">{result.error}</p>
                  <button onClick={reset} className="mt-1 font-bold text-xs text-slate-400 hover:text-slate-600">
                    VOLVER A INTENTAR
                  </button>
                </div>
              )}

              {/* ---- SELECT ACTION STATE ---- */}
              {uiState === 'selecting_action' && (
                <div className="space-y-4">
                  <div className="text-center">
                    <h2 className="text-xl font-bold text-slate-900">¿Qué acción realizas?</h2>
                    <p className="mt-0.5 text-xs font-mono text-slate-400">PIN INGRESADO CORRECTAMENTE</p>
                  </div>

                  <div className="grid grid-cols-1 gap-2.5">
                    <button
                      onClick={() => executeAction('clock_in')}
                      className="group flex items-center justify-between rounded-2xl bg-slate-50 p-3.5 transition hover:bg-emerald-50 hover:ring-1 hover:ring-emerald-200"
                    >
                      <span className="font-bold text-slate-700 group-hover:text-emerald-700 text-sm">INICIO DE TURNO</span>
                      <span className="h-2 w-2 rounded-full bg-emerald-500" />
                    </button>
                    <button
                      onClick={() => executeAction('break_in')}
                      className="group flex items-center justify-between rounded-2xl bg-slate-50 p-3.5 transition hover:bg-blue-50 hover:ring-1 hover:ring-blue-200"
                    >
                      <span className="font-bold text-slate-700 group-hover:text-blue-700 text-sm">INICIAR DESCANSO</span>
                      <span className="h-2 w-2 rounded-full bg-blue-500" />
                    </button>
                    <button
                      onClick={() => executeAction('break_out')}
                      className="group flex items-center justify-between rounded-2xl bg-slate-50 p-3.5 transition hover:bg-indigo-50 hover:ring-1 hover:ring-indigo-200"
                    >
                      <span className="font-bold text-slate-700 group-hover:text-indigo-700 text-sm">FIN DE DESCANSO</span>
                      <span className="h-2 w-2 rounded-full bg-indigo-500" />
                    </button>
                    <button
                      onClick={() => executeAction('clock_out')}
                      className="group flex items-center justify-between rounded-2xl bg-slate-50 p-3.5 transition hover:bg-red-50 hover:ring-1 hover:ring-red-200"
                    >
                      <span className="font-bold text-slate-700 group-hover:text-red-700 text-sm">FINALIZAR TURNO</span>
                      <span className="h-2 w-2 rounded-full bg-red-500" />
                    </button>
                  </div>

                  <button onClick={reset} className="w-full py-1.5 text-xs font-bold text-slate-400 hover:text-slate-600">
                    CANCELAR
                  </button>
                </div>
              )}

              {/* ---- IDLE STATE (PIN ENTRY) ---- */}
              {uiState === 'idle' && (
                <>
                  <h2 className="text-center text-xl font-bold text-slate-900">Ingrese su PIN</h2>
                  <p className="mt-0.5 text-center text-[10px] font-bold text-slate-400 tracking-widest uppercase">Identificación de Personal</p>

                  {/* PIN indicators */}
                  <div className="mt-4 grid grid-cols-4 gap-3">
                    {[0, 1, 2, 3].map((i) => (
                      <div
                        key={i}
                        className={`h-12 rounded-2xl border-2 text-2xl font-bold leading-[2.75rem] text-center transition-all duration-300 ${
                          pin[i]
                            ? 'border-slate-900 bg-slate-900 text-white scale-105'
                            : 'border-slate-100 bg-slate-50 text-slate-200'
                        }`}
                      >
                        {pin[i] ? '•' : '0'}
                      </div>
                    ))}
                  </div>

                  {/* Keypad */}
                  <div className="mt-4 grid grid-cols-3 gap-2.5">
                    {keys.map((key) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => addDigit(key)}
                        className="h-14 rounded-2xl bg-slate-50 text-2xl font-bold text-slate-800 transition hover:bg-slate-100 active:scale-95"
                      >
                        {key}
                      </button>
                    ))}

                    <button
                      type="button"
                      onClick={clearPin}
                      className="h-14 rounded-2xl text-xs font-bold text-slate-400 transition hover:text-slate-600 active:scale-95"
                    >
                      BORRAR
                    </button>

                    <button
                      type="button"
                      onClick={() => addDigit('0')}
                      className="h-14 rounded-2xl bg-slate-50 text-2xl font-bold text-slate-800 transition hover:bg-slate-100 active:scale-95"
                    >
                      0
                    </button>

                    <div className="flex h-14 items-center justify-center">
                       {/* Placeholder para balancear grid */}
                    </div>
                  </div>
                </>
              )}

              {/* ---- LOADING STATE ---- */}
              {uiState === 'loading' && (
                <div className="flex flex-col items-center justify-center py-10">
                  <div className="h-12 w-12 animate-spin rounded-full border-4 border-slate-900 border-t-transparent" />
                  <p className="mt-5 text-sm font-bold text-slate-500 animate-pulse">PROCESANDO MARCACIÓN...</p>
                </div>
              )}

              {/* Mensaje Personalizado */}
              <div className="mt-5 border-t border-slate-50 pt-3 text-center">
                <p className="text-[11px] font-medium leading-relaxed text-slate-400 italic">
                  &ldquo;{customMessage}&rdquo;
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <footer className="py-4 flex flex-col items-center gap-2">
          <p className="text-[10px] text-slate-600/40 tracking-wide">
            © {new Date().getFullYear()} {companyName}. Todos los derechos reservados.
          </p>
          <Link
            href="/login"
            className="text-[10px] font-bold tracking-widest text-slate-600/30 transition hover:text-slate-600 uppercase"
          >
            Acceso Administrativo
          </Link>
        </footer>
      </div>
    </main>
  )
}
