'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

import { EventType, KioskResult, UIState, KioskClientProps } from '../types/kiosk'
import { getKioskByDeviceCode } from '../actions/kiosk'

export function KioskClient({ initialLogoUrl, initialKioskBgUrl, initialCompanyName, initialCustomMessage }: KioskClientProps) {
  const [pin, setPin]             = useState('')
  const [time, setTime]           = useState('')
  const [date, setDate]           = useState('')
  const [uiState, setUiState]     = useState<UIState>('loading')
  const [result, setResult]       = useState<KioskResult | null>(null)
  const [deviceCode, setDeviceCode] = useState('')
  const [kioskData, setKioskData]   = useState<{
    branch_id: string;
    branch_name: string;
    company_name: string;
    logo_url: string | null;
  } | null>(null)
  
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Cargar dispositivo desde localStorage al inicio
  useEffect(() => {
    const loadDevice = async () => {
      const storedCode = localStorage.getItem('kiosk_device_code')
      if (storedCode) {
        const { data, error } = await getKioskByDeviceCode(storedCode)
        if (data && !error) {
          setKioskData({
            branch_id: data.branch_id,
            branch_name: data.branch_name,
            company_name: data.company_name,
            logo_url: data.logo_url
          })
          setUiState('idle')
        } else {
          setUiState('linking')
        }
      } else {
        setUiState('linking')
      }
    }
    loadDevice()
  }, [])

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
    if (!kioskData?.branch_id) {
      setResult({ success: false, error: 'No hay sucursal activa configurada.' })
      setUiState('error')
      resetTimer.current = setTimeout(reset, 4000)
      return
    }
    setUiState('selecting_action')
  }

  const linkDevice = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!deviceCode) return
    setUiState('loading')
    
    const { data, error } = await getKioskByDeviceCode(deviceCode)
    if (error || !data) {
      setResult({ success: false, error: error || 'Error vinculando dispositivo.' })
      setUiState('error')
      setTimeout(() => setUiState('linking'), 3000)
      return
    }

    localStorage.setItem('kiosk_device_code', deviceCode)
    setKioskData({
      branch_id: data.branch_id,
      branch_name: data.branch_name,
      company_name: data.company_name,
      logo_url: data.logo_url
    })
    setDeviceCode('')
    setUiState('idle')
  }

  const executeAction = async (type: EventType) => {
    setUiState('loading')

    const supabase = createClient()
    const { data, error } = await supabase.rpc('kiosk_clock_event', {
      p_branch_id:  kioskData?.branch_id,
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
      className="min-h-screen relative flex items-center justify-center overflow-hidden"
      style={
        initialKioskBgUrl
          ? { backgroundImage: `url(${initialKioskBgUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' }
          : { background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 50%, #3b82f6 100%)' }
      }
    >
      {/* Elementos decorativos de fondo */}
      {!initialKioskBgUrl && (
        <>
          <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-white/10 rounded-full blur-[120px]" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-blue-400/20 rounded-full blur-[120px]" />
        </>
      )}
      {initialKioskBgUrl && <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" />}

      <div className="relative z-10 w-full max-w-lg px-4 flex flex-col items-center">
        
        {/* Header Kiosko */}
        <div className="mb-8 text-center animate-in fade-in slide-in-from-top-4 duration-700">
          {(kioskData?.logo_url || initialLogoUrl) && (
            <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-3xl bg-white/95 p-3 shadow-2xl backdrop-blur-sm ring-1 ring-white/20">
              <img src={kioskData?.logo_url || initialLogoUrl as string} alt="Logo" className="h-full w-full object-contain" />
            </div>
          )}
          <h1 className="text-4xl font-black tracking-tight text-white drop-shadow-sm uppercase">
            {kioskData?.company_name || initialCompanyName}
          </h1>
          <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1.5 backdrop-blur-md ring-1 ring-white/20">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="text-xs font-bold tracking-[0.1em] text-white/90">
              📍 {kioskData?.branch_name ?? 'ESPERANDO VINCULACIÓN'}
            </span>
          </div>
        </div>

        {/* Reloj Digital */}
        <div className="mb-8 text-center">
          <p className="text-6xl font-black tabular-nums text-white tracking-tighter drop-shadow-xl">
            {time}
          </p>
          <p className="mt-2 text-sm font-bold uppercase tracking-[0.2em] text-white/60">
            {date}
          </p>
        </div>

        {/* Tarjeta Central (Kiosk Card) */}
        <div className="w-full max-w-sm rounded-[40px] bg-white p-8 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.3)] ring-1 ring-black/5 relative overflow-hidden">
          
          {/* ---- IDLE / PIN ENTRY ---- */}
          {uiState === 'idle' && (
            <div className="animate-in fade-in zoom-in-95 duration-300">
              <div className="text-center mb-8">
                <h2 className="text-2xl font-black text-slate-900">Bienvenido</h2>
                <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mt-1">Ingrese su PIN de 4 dígitos</p>
              </div>

              {/* PIN Display Indicators */}
              <div className="flex justify-center gap-4 mb-8">
                {[0, 1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className={`h-16 w-14 rounded-2xl flex items-center justify-center text-3xl font-bold transition-all duration-300 border-2 ${
                      pin[i]
                        ? 'border-[#4f46e5] bg-[#4f46e5]/5 text-[#4f46e5] scale-105 shadow-[0_0_20px_rgba(79,70,229,0.15)]'
                        : 'border-slate-100 bg-slate-50 text-slate-200'
                    }`}
                  >
                    {pin[i] ? <div className="w-3 h-3 rounded-full bg-[#4f46e5]" /> : '0'}
                  </div>
                ))}
              </div>

              {/* Keypad */}
              <div className="grid grid-cols-3 gap-3">
                {keys.map((key) => (
                  <button
                    key={key}
                    onClick={() => addDigit(key)}
                    className="h-16 rounded-2xl bg-slate-50 text-2xl font-bold text-slate-800 transition-all hover:bg-slate-100 active:scale-90 active:bg-slate-200 shadow-sm"
                  >
                    {key}
                  </button>
                ))}
                <button
                  onClick={clearPin}
                  className="h-16 rounded-2xl text-[10px] font-black tracking-wider text-slate-400 hover:text-red-500 uppercase transition-colors"
                >
                  BORRAR
                </button>
                <button
                  onClick={() => addDigit('0')}
                  className="h-16 rounded-2xl bg-slate-50 text-2xl font-bold text-slate-800 transition-all hover:bg-slate-100 active:scale-90 active:bg-slate-200 shadow-sm"
                >
                  0
                </button>
                <div className="flex items-center justify-center h-16">
                  {/* Empty space */}
                </div>
              </div>
            </div>
          )}

          {/* ---- LOADING ---- */}
          {uiState === 'loading' && (
            <div className="py-12 flex flex-col items-center justify-center animate-in fade-in duration-300">
              <div className="relative h-20 w-20">
                <div className="absolute inset-0 rounded-full border-4 border-[#4f46e5]/20" />
                <div className="absolute inset-0 rounded-full border-4 border-[#4f46e5] border-t-transparent animate-spin" />
              </div>
              <p className="mt-8 text-sm font-black tracking-[0.2em] text-[#4f46e5] animate-pulse">PROCESANDO...</p>
            </div>
          )}

          {/* ---- RESULT (SUCCESS/ERROR) ---- */}
          {(uiState === 'success' || uiState === 'error') && result && (
            <div className={`p-4 text-center animate-in zoom-in-95 duration-300`}>
              <div className={`mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-full shadow-lg ${
                result.success ? 'bg-emerald-50 text-emerald-500 ring-8 ring-emerald-50/50' : 'bg-red-50 text-red-500 ring-8 ring-red-50/50'
              }`}>
                {result.success ? (
                  <svg className="h-12 w-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <svg className="h-12 w-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                )}
              </div>
              
              <h3 className="text-2xl font-black text-slate-900 leading-tight">
                {result.success ? result.employee_name : '¡Error!'}
              </h3>
              
              {result.success ? (
                <>
                  <p className="mt-2 text-sm font-bold text-slate-400 font-mono tracking-widest uppercase">
                    ID: {result.employee_code}
                  </p>
                  <p className="mt-6 text-lg font-black uppercase tracking-wider text-emerald-600">
                    {result.event_type === 'clock_in' ? '✓ Turno Iniciado' :
                     result.event_type === 'clock_out' ? '✓ Turno Finalizado' :
                     result.event_type === 'break_in' ? '✓ Descanso Iniciado' : '✓ Descanso Finalizado'}
                  </p>
                </>
              ) : (
                <p className="mt-4 text-sm font-bold leading-relaxed text-red-500 bg-red-50 rounded-2xl p-4 border border-red-100">
                  {result.error}
                </p>
              )}

              <p className="mt-8 text-[10px] font-black tracking-[0.3em] text-slate-300 uppercase">
                {result.success ? 'Regresando en 5s' : 'Regresando en 4s'}
              </p>
            </div>
          )}

          {/* ---- SELECT ACTION ---- */}
          {uiState === 'selecting_action' && (
            <div className="animate-in slide-in-from-bottom-8 duration-300">
              <div className="text-center mb-6">
                <h2 className="text-2xl font-black text-slate-900">Elija Acción</h2>
                <p className="text-[10px] font-black tracking-widest text-emerald-500 mt-1 uppercase">✓ PIN VALIDADO</p>
              </div>

              <div className="grid gap-3">
                {[
                  { id: 'clock_in', label: 'INICIO DE TURNO', color: 'bg-emerald-50', hover: 'hover:bg-emerald-600 hover:text-white', text: 'text-emerald-700', icon: 'M13 5l7 7-7 7' },
                  { id: 'break_in', label: 'INICIAR DESCANSO', color: 'bg-blue-50', hover: 'hover:bg-blue-600 hover:text-white', text: 'text-blue-700', icon: 'M12 8v4l3 3' },
                  { id: 'break_out', label: 'FIN DE DESCANSO', color: 'bg-indigo-50', hover: 'hover:bg-indigo-600 hover:text-white', text: 'text-indigo-700', icon: 'M5 13l4 4L19 7' },
                  { id: 'clock_out', label: 'FINALIZAR TURNO', color: 'bg-red-50', hover: 'hover:bg-red-600 hover:text-white', text: 'text-red-700', icon: 'M13 19l-7-7 7-7' }
                ].map((item) => (
                  <button
                    key={item.id}
                    onClick={() => executeAction(item.id as EventType)}
                    className={`group flex items-center justify-between rounded-2xl ${item.color} p-4 transition-all duration-200 shadow-sm ${item.hover}`}
                  >
                    <span className={`text-sm font-black tracking-wide ${item.text} group-hover:text-white transition-colors`}>
                      {item.label}
                    </span>
                    <div className="h-2 w-2 rounded-full bg-current opacity-60" />
                  </button>
                ))}
              </div>

              <button 
                onClick={reset}
                className="mt-6 w-full py-2 text-[10px] font-black tracking-[0.2em] text-slate-400 hover:text-slate-600 uppercase"
              >
                ← Cancelar
              </button>
            </div>
          )}

          {/* ---- LINKING SCREEN ---- */}
          {uiState === 'linking' && (
            <div className="animate-in fade-in zoom-in-95 duration-300">
              <div className="text-center mb-6">
                <h2 className="text-2xl font-black text-slate-900">Vincular Kiosko</h2>
                <p className="text-[10px] font-black tracking-widest text-slate-400 mt-1 uppercase">EL DISPOSITIVO NO ESTÁ ASOCIADO</p>
              </div>

              <form onSubmit={linkDevice} className="space-y-4">
                <div>
                  <label className="text-[10px] font-black tracking-widest text-slate-400 ml-1 uppercase">CÓDIGO DEL DISPOSITIVO</label>
                  <input
                    type="text"
                    value={deviceCode}
                    onChange={(e) => setDeviceCode(e.target.value)}
                    placeholder="Ej: DELL01"
                    className="mt-1 h-16 w-full rounded-2xl border-2 border-slate-100 bg-slate-50 px-6 text-xl font-bold uppercase outline-none transition-all focus:border-[#4f46e5] focus:bg-white focus:ring-4 focus:ring-[#4f46e5]/5"
                  />
                </div>
                <button
                  type="submit"
                  className="h-16 w-full rounded-2xl bg-[#4f46e5] text-sm font-black tracking-widest text-white shadow-lg transition-all hover:bg-[#4338ca] active:scale-[0.98]"
                >
                  VINCULAR AHORA
                </button>
              </form>

              <p className="mt-8 text-[10px] leading-relaxed text-slate-400 text-center uppercase font-bold px-4">
                Obtenga el código desde el panel administrativo en la sección "Dispositivos Kiosko".
              </p>
            </div>
          )}

          {/* Custom Message Container */}
          <div className="mt-8 border-t border-slate-50 pt-5 text-center">
             <p className="text-[11px] font-bold leading-relaxed text-slate-400 italic">
               &ldquo;{initialCustomMessage}&rdquo;
             </p>
          </div>
        </div>

        {/* Footer Administrativo y Copyright */}
        <div className="mt-12 text-center opacity-60">
          <p className="text-[10px] font-bold tracking-[0.1em] text-white/40 uppercase">
             © {new Date().getFullYear()} {kioskData?.company_name || initialCompanyName} · SOFTWARE DE CONTROL
          </p>
          <div className="mt-4 flex items-center justify-center gap-6">
            <Link 
              href="/login"
              className="group flex items-center gap-2 text-[10px] font-black tracking-[0.2em] text-white/40 transition-colors hover:text-white uppercase"
            >
              <svg className="h-3 w-3 transition-transform group-hover:-translate-y-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Admin Access
            </Link>
          </div>
        </div>
      </div>
    </main>

  )
}
