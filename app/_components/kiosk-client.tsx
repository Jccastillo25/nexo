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
}

type EventType = 'clock_in' | 'clock_out'

type KioskResult =
  | { success: true; employee_name: string; event_type: EventType; tardiness_minutes: number; overtime_minutes: number }
  | { success: false; error: string }

type UIState = 'idle' | 'loading' | 'success' | 'error'

export function KioskClient({ logoUrl, kioskBgUrl, companyName, branchId, branchName }: KioskClientProps) {
  const [pin, setPin]             = useState('')
  const [eventType, setEventType] = useState<EventType>('clock_in')
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

  const submitPin = async () => {
    if (pin.length !== 4 || uiState === 'loading') return
    if (!branchId) {
      setResult({ success: false, error: 'No hay sucursal activa configurada. Contacte al administrador.' })
      setUiState('error')
      resetTimer.current = setTimeout(reset, 4000)
      return
    }

    setUiState('loading')

    const supabase = createClient()
    const { data, error } = await supabase.rpc('kiosk_clock_event', {
      p_branch_id:  branchId,
      p_pin:        pin,
      p_event_type: eventType,
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

  // Auto-submit cuando el PIN llega a 4 dígitos
  useEffect(() => {
    if (pin.length === 4 && uiState === 'idle') {
      submitPin()
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
        {/* Topbar */}
        <header className="flex items-center justify-between px-8 py-5">
          <div className="flex items-center gap-3">
            {logoUrl ? (
              <img src={logoUrl} alt="Logo" className="h-8 w-auto object-contain" />
            ) : (
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">{companyName}</p>
                <p className="mt-0.5 text-sm font-semibold text-slate-300">Sistema de Control de Asistencia</p>
              </div>
            )}
          </div>
          <Link
            href="/login"
            className="rounded-2xl border border-slate-700 bg-slate-800/80 px-5 py-2.5 text-sm font-semibold text-slate-300 backdrop-blur transition hover:bg-slate-700 hover:text-white"
          >
            Área Administrativa →
          </Link>
        </header>

        {/* Main content */}
        <div className="flex flex-1 items-center justify-center px-4 py-8">
          <div className="w-full max-w-sm">

            {/* Clock */}
            <div className="mb-8 text-center">
              <p className="text-6xl font-bold tabular-nums text-white tracking-tight">{time}</p>
              <p className="mt-2 text-sm capitalize text-slate-400">{date}</p>
              <p className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-slate-700 bg-slate-800/80 px-3 py-1 text-xs font-semibold text-slate-400 backdrop-blur">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                {branchName ?? 'Sucursal'}
              </p>
            </div>

            {/* Card */}
            <div className="rounded-3xl bg-white p-8 shadow-2xl">

              {/* ---- SUCCESS STATE ---- */}
              {isSuccess && result?.success && (
                <div className="flex flex-col items-center gap-4 py-4 text-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
                    <svg className="h-8 w-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-slate-900">{result.employee_name}</p>
                    <p className="mt-1 text-sm font-semibold text-green-600">
                      {result.event_type === 'clock_in' ? '✓ Entrada registrada' : '✓ Salida registrada'}
                    </p>
                    {result.tardiness_minutes > 0 && (
                      <p className="mt-2 text-xs text-amber-600">
                        ⚠ Tardanza: {result.tardiness_minutes} min
                      </p>
                    )}
                    {result.overtime_minutes > 0 && (
                      <p className="mt-2 text-xs text-blue-600">
                        ★ Horas extra: {result.overtime_minutes} min
                      </p>
                    )}
                  </div>
                  <p className="text-xs text-slate-400">Reiniciando en unos segundos…</p>
                </div>
              )}

              {/* ---- ERROR STATE ---- */}
              {isError && result && !result.success && (
                <div className="flex flex-col items-center gap-4 py-4 text-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
                    <svg className="h-8 w-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-slate-900">Error</p>
                    <p className="mt-1 text-sm text-red-600">{result.error}</p>
                  </div>
                  <button
                    type="button"
                    onClick={reset}
                    className="rounded-2xl bg-slate-900 px-6 py-2.5 text-sm font-bold text-white hover:bg-slate-800"
                  >
                    Intentar de nuevo
                  </button>
                </div>
              )}

              {/* ---- NORMAL STATE ---- */}
              {!isSuccess && !isError && (
                <>
                  {/* Toggle Entrada / Salida */}
                  <div className="grid grid-cols-2 gap-2 rounded-2xl bg-slate-100 p-1.5">
                    <button
                      type="button"
                      onClick={() => setEventType('clock_in')}
                      className={`rounded-xl py-2.5 text-sm font-bold transition ${
                        eventType === 'clock_in'
                          ? 'bg-white text-slate-900 shadow-sm'
                          : 'text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      Entrada
                    </button>
                    <button
                      type="button"
                      onClick={() => setEventType('clock_out')}
                      className={`rounded-xl py-2.5 text-sm font-bold transition ${
                        eventType === 'clock_out'
                          ? 'bg-white text-slate-900 shadow-sm'
                          : 'text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      Salida
                    </button>
                  </div>

                  <h2 className="mt-5 text-center text-xl font-bold text-slate-900">Ingrese su PIN</h2>
                  <p className="mt-1 text-center text-xs text-slate-500">PIN de 4 dígitos</p>

                  {/* PIN indicators */}
                  <div className="mt-5 grid grid-cols-4 gap-3">
                    {[0, 1, 2, 3].map((i) => (
                      <div
                        key={i}
                        className={`h-12 rounded-2xl border-2 text-2xl font-bold leading-[2.75rem] text-center transition-colors ${
                          pin[i]
                            ? 'border-slate-900 bg-slate-900 text-white'
                            : 'border-slate-200 bg-slate-50 text-transparent'
                        }`}
                      >
                        •
                      </div>
                    ))}
                  </div>

                  {/* Keypad */}
                  <div className="mt-5 grid grid-cols-3 gap-3">
                    {keys.map((key) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => addDigit(key)}
                        disabled={uiState === 'loading'}
                        className="h-14 rounded-2xl bg-slate-100 text-2xl font-bold text-slate-900 transition hover:bg-slate-200 active:scale-95 disabled:opacity-50"
                      >
                        {key}
                      </button>
                    ))}

                    <button
                      type="button"
                      onClick={clearPin}
                      disabled={uiState === 'loading'}
                      className="h-14 rounded-2xl border border-slate-200 text-sm font-semibold text-slate-500 transition hover:bg-slate-100 active:scale-95 disabled:opacity-50"
                    >
                      ← Borrar
                    </button>

                    <button
                      type="button"
                      onClick={() => addDigit('0')}
                      disabled={uiState === 'loading'}
                      className="h-14 rounded-2xl bg-slate-100 text-2xl font-bold text-slate-900 transition hover:bg-slate-200 active:scale-95 disabled:opacity-50"
                    >
                      0
                    </button>

                    <button
                      type="button"
                      onClick={submitPin}
                      disabled={pin.length !== 4 || uiState === 'loading'}
                      className="h-14 rounded-2xl bg-slate-900 text-sm font-bold text-white transition hover:bg-slate-800 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {uiState === 'loading' ? (
                        <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      ) : (
                        'Marcar'
                      )}
                    </button>
                  </div>
                </>
              )}

            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
