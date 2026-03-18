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
      // Formato solicitado: 03:57 a. m.
      setTime(
        new Intl.DateTimeFormat('es-NI', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: true,
        }).format(now).replace(/\s([AP]M)$/i, (match) => match.toLowerCase().split('').join('.') + '.')
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
      setResult({
        ...res,
        event_type: type // Aseguramos el tipo para el visual
      })
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

  return (
    <div className="bg-mesh min-h-screen flex flex-col font-display antialiased text-slate-900 select-none overflow-hidden">
      
      {/* --- HEADER --- */}
      <header className="w-full px-6 py-6 flex justify-between items-center max-w-7xl mx-auto z-10 transition-all">
        <div className="flex items-center gap-3 text-white">
          <div className="bg-[#0d7ff2] p-2 rounded-xl shadow-lg shadow-blue-500/20 ring-1 ring-white/10">
            {kioskData?.logo_url || initialLogoUrl ? (
              <img src={kioskData?.logo_url || initialLogoUrl as string} alt="Logo" className="w-7 h-7 object-contain" />
            ) : (
              <span className="material-symbols-outlined text-white text-2xl">apps</span>
            )}
          </div>
          <div className="flex flex-col">
            <span className="text-xl font-black tracking-tight leading-none uppercase italic">
              {kioskData?.company_name || initialCompanyName || 'Gestor360'}
            </span>
            <span className="text-[9px] font-bold tracking-[0.2em] text-blue-400 mt-1 uppercase">SISTEMA INTEGRAL</span>
          </div>
        </div>

        <div className="flex items-center gap-5">
          <div className="hidden sm:block text-right">
            <p className="text-slate-400 text-[10px] uppercase tracking-widest font-black opacity-80 mb-0.5">Sucursal Activa</p>
            <p className="text-white text-sm font-bold tracking-tight">
               {kioskData?.branch_name ?? 'SIN VINCULAR'}
            </p>
          </div>
          <div className="size-11 rounded-full border-2 border-[#0d7ff2]/30 p-1 bg-white/5 backdrop-blur-sm shadow-xl transition-transform hover:scale-105">
             <div className="w-full h-full rounded-full bg-slate-800 flex items-center justify-center overflow-hidden bg-cover bg-center"
               style={kioskData?.logo_url || initialLogoUrl ? { backgroundImage: `url(${kioskData?.logo_url || initialLogoUrl})` } : {}}
             >
                {!(kioskData?.logo_url || initialLogoUrl) && <span className="material-symbols-outlined text-slate-400 text-sm">business</span>}
             </div>
          </div>
        </div>
      </header>

      {/* --- MAIN CONTENT --- */}
      <main className="flex-grow flex items-center justify-center px-4 py-8 relative z-0">
        <div className="w-full max-w-[460px] animate-in fade-in zoom-in-95 duration-500">
          
          <div className="bg-white rounded-[2.5rem] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.5)] overflow-hidden ring-1 ring-slate-100 relative">
            
            {/* VINCULACIÓN */}
            {uiState === 'linking' && (
              <div className="p-10 sm:p-14 text-center">
                <div className="relative mb-10 inline-block">
                  <div className="absolute inset-0 bg-blue-500/10 rounded-full scale-[1.8] blur-2xl animate-pulse"></div>
                  <div className="relative size-24 bg-[#0d7ff2] rounded-[2rem] flex items-center justify-center shadow-2xl shadow-blue-500/30 transform rotate-3">
                    <span className="material-symbols-outlined text-white text-5xl font-bold">add_to_drive</span>
                  </div>
                </div>
                <h1 className="text-slate-900 text-3xl font-black leading-tight mb-4 tracking-tight">Asociar Dispositivo</h1>
                <p className="text-slate-500 text-sm font-medium mb-10 px-4">Ingrese el código único del terminal para vincularlo a su sucursal.</p>
                <form onSubmit={linkDevice} className="space-y-6">
                  <input
                    type="text"
                    value={deviceCode}
                    onChange={(e) => setDeviceCode(e.target.value)}
                    placeholder="CÓDIGO DE DISPOSITIVO"
                    className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-5 text-lg font-black tracking-[0.1em] text-slate-900 text-center uppercase outline-none focus:bg-white focus:border-blue-500 transition-all"
                  />
                  <button className="w-full bg-[#0d7ff2] hover:bg-blue-600 text-white font-black py-5 rounded-2xl shadow-xl transition-all active:scale-[0.97] flex items-center justify-center gap-3 text-sm tracking-widest uppercase">
                    Vincular Kiosko
                    <span className="material-symbols-outlined text-xl">arrow_forward_ios</span>
                  </button>
                </form>
              </div>
            )}

            {/* CARGANDO */}
            {uiState === 'loading' && (
              <div className="p-20 flex flex-col items-center justify-center">
                 <div className="relative size-24">
                    <div className="absolute inset-0 rounded-full border-[6px] border-slate-100"></div>
                    <div className="absolute inset-0 rounded-full border-[6px] border-blue-500 border-t-transparent animate-spin duration-[1500ms]"></div>
                 </div>
                 <p className="mt-10 text-[10px] font-black tracking-[0.4em] text-blue-500/60 uppercase animate-pulse">Procesando Registro</p>
              </div>
            )}

            {/* IDLE (PIN) */}
            {uiState === 'idle' && (
              <div className="p-8 sm:p-12">
                <div className="text-center mb-10">
                  <h2 className="text-3xl font-black text-slate-900 tracking-tight">Bienvenido/a</h2>
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400 mt-2">Identifíquese con su PIN</p>
                </div>
                <div className="flex justify-center gap-4 mb-10">
                  {[0,1,2,3].map(i => (
                    <div key={i} className={`size-16 rounded-[1.25rem] flex items-center justify-center border-[3px] transition-all ${pin[i] ? 'border-blue-500 bg-blue-50 shadow-xl shadow-blue-500/10' : 'border-slate-100 bg-white'}`}>
                      {pin[i] ? <div className="size-4 bg-blue-500 rounded-full shadow-lg animate-in zoom-in-50" /> : <div className="size-3 bg-slate-200 rounded-full" />}
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-3 gap-3">
                  {keys.map(key => (
                    <button key={key} onClick={() => addDigit(key)} className="h-20 rounded-2xl bg-slate-50 text-2xl font-black text-slate-800 transition-all hover:bg-slate-100 active:scale-95 active:bg-blue-500 active:text-white shadow-sm ring-1 ring-slate-100">{key}</button>
                  ))}
                  <button onClick={clearPin} className="h-20 rounded-2xl flex items-center justify-center group"><span className="material-symbols-outlined text-slate-300 text-3xl font-bold group-hover:text-red-500 transition-colors">backspace</span></button>
                  <button onClick={() => addDigit('0')} className="h-20 rounded-2xl bg-slate-50 text-2xl font-black text-slate-800 hover:bg-slate-100 active:scale-95 active:bg-blue-500 active:text-white shadow-sm ring-1 ring-slate-100">0</button>
                  <div className="flex items-center justify-center"><div className="size-2 rounded-full bg-slate-100" /></div>
                </div>
              </div>
            )}

            {/* SELECCIÓN DE ACCIÓN */}
            {uiState === 'selecting_action' && (
              <div className="p-8 sm:p-12 flex flex-col items-center">
                <div className="w-32 h-32 mb-8 flex items-center justify-center relative">
                   <div className="absolute inset-0 bg-blue-500/10 rounded-full scale-125 blur-2xl" />
                   <div className="relative size-24 bg-white rounded-3xl shadow-2xl flex items-center justify-center border border-slate-100">
                     {kioskData?.logo_url || initialLogoUrl ? <img src={kioskData?.logo_url || initialLogoUrl as string} alt="Company" className="size-14 object-contain" /> : <span className="material-symbols-outlined text-blue-500 text-4xl">person</span>}
                   </div>
                </div>
                <div className="text-center mb-8">
                  <h1 className="text-slate-900 text-3xl font-black leading-tight mb-2 tracking-tight">Bienvenido/a</h1>
                  <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-blue-50 text-blue-600 rounded-full text-[10px] font-black uppercase tracking-widest border border-blue-100">
                     <span className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" /><span className="relative inline-flex rounded-full h-2 w-2 bg-blue-600" /></span>Perfil Validado
                  </div>
                </div>
                <div className="w-full px-8 py-6 bg-slate-50 rounded-3xl border border-slate-100 mb-10 text-center hover:bg-white hover:shadow-xl transition-all">
                  <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.3em] mb-2">Hora Actual</p>
                  <span className="text-slate-900 font-black text-4xl tracking-tighter tabular-nums">{time}</span>
                </div>
                <div className="w-full space-y-4">
                  <button onClick={() => executeAction('clock_in')} className="w-full py-5 px-6 bg-[#0d7ff2] hover:bg-blue-600 text-white rounded-2xl font-black flex items-center justify-between shadow-2xl transition-all active:scale-[0.98] group">
                    <div className="flex items-center gap-4"><span className="material-symbols-outlined text-2xl opacity-80">login</span><span className="text-base tracking-tight">Marcar Entrada</span></div>
                    <span className="material-symbols-outlined text-xl transform group-hover:translate-x-1 transition-transform">chevron_right</span>
                  </button>
                  <div className="grid grid-cols-2 gap-4">
                    <button onClick={() => executeAction('break_in')} className="py-5 bg-white hover:bg-slate-50 text-slate-600 border-2 border-slate-100 rounded-2xl font-bold text-xs flex flex-col items-center gap-3 transition-all active:scale-[0.96]"><span className="material-symbols-outlined text-2xl text-slate-400">coffee</span>Inicio Descanso</button>
                    <button onClick={() => executeAction('break_out')} className="py-5 bg-white hover:bg-slate-50 text-slate-600 border-2 border-slate-100 rounded-2xl font-bold text-xs flex flex-col items-center gap-3 transition-all active:scale-[0.96]"><span className="material-symbols-outlined text-2xl text-slate-400">restaurant</span>Fin Descanso</button>
                  </div>
                  <button onClick={() => executeAction('clock_out')} className="w-full py-5 px-6 bg-slate-900 hover:bg-black text-white rounded-2xl font-black flex items-center justify-between shadow-2xl transition-all active:scale-[0.98] group">
                    <div className="flex items-center gap-4"><span className="material-symbols-outlined text-2xl opacity-80">logout</span><span className="text-base tracking-tight">Marcar Salida</span></div>
                    <span className="material-symbols-outlined text-xl transform group-hover:translate-x-1 transition-transform">chevron_right</span>
                  </button>
                </div>
                <button onClick={reset} className="mt-10 text-[10px] font-black uppercase tracking-[0.4em] text-slate-300 hover:text-red-500 transition-colors">← Cancelar Operación</button>
              </div>
            )}

            {/* ÉXITO */}
            {uiState === 'success' && result && result.success && (
              <div className="p-10 sm:p-14">
                <div className="mb-12 text-center flex flex-col items-center">
                  <div className="relative mb-8">
                    <div className="absolute inset-0 bg-emerald-500/10 rounded-full scale-[1.9] blur-2xl animate-pulse" />
                    <div className="relative size-24 bg-emerald-500 rounded-[2rem] flex items-center justify-center shadow-2xl shadow-emerald-500/30 rotate-6">
                      <span className="material-symbols-outlined text-white text-5xl font-bold animate-in zoom-in-50 duration-500">check</span>
                    </div>
                  </div>
                  <h1 className="text-slate-900 text-3xl font-black leading-tight mb-3 tracking-tight">¡Marcación Exitosa!</h1>
                  <p className="text-slate-500 text-base font-medium">Hola, <span className="text-slate-900 font-black">{result.employee_name}</span>. <br />Tu registro se ha procesado con éxito.</p>
                </div>
                <div className="space-y-3 mb-12">
                  <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100 flex justify-between items-center transition-transform hover:scale-[1.02]">
                    <div className="flex items-center gap-4"><div className="size-10 bg-white rounded-xl flex items-center justify-center shadow-sm border border-slate-100"><span className="material-symbols-outlined text-blue-500 text-xl">schedule</span></div><p className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Hora de registro</p></div>
                    <p className="text-slate-900 text-xl font-black tabular-nums">{time}</p>
                  </div>
                  <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100 flex justify-between items-center transition-transform hover:scale-[1.02]">
                    <div className="flex items-center gap-4"><div className="size-10 bg-white rounded-xl flex items-center justify-center shadow-sm border border-slate-100"><span className="material-symbols-outlined text-blue-500 text-xl">label</span></div><p className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Tipo de acción</p></div>
                    <span className="px-4 py-1.5 bg-blue-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-blue-500/20">
                      {result.event_type === 'clock_in' ? 'Entrada' : result.event_type === 'clock_out' ? 'Salida' : result.event_type === 'break_in' ? 'Inicio Descanso' : 'Fin Descanso'}
                    </span>
                  </div>
                </div>
                <button onClick={reset} className="w-full bg-slate-900 hover:bg-black text-white font-black py-5 rounded-2xl shadow-2xl transition-all active:scale-[0.98] flex items-center justify-center gap-3 text-sm tracking-widest uppercase mb-10">Finalizar<span className="material-symbols-outlined text-xl">done_all</span></button>
                <div className="flex flex-col items-center gap-4 opacity-40">
                  <div className="flex gap-2">
                    <div className="size-1.5 rounded-full bg-blue-500 animate-bounce duration-700" />
                    <div className="size-1.5 rounded-full bg-blue-500 animate-bounce duration-[800ms]" />
                    <div className="size-1.5 rounded-full bg-blue-500 animate-bounce duration-[900ms]" />
                  </div>
                  <p className="text-slate-500 text-[9px] font-black uppercase tracking-[0.3em]">Auto-cierre en 5 segundos</p>
                </div>
              </div>
            )}

            {/* ERROR */}
            {(uiState === 'error' || (result && !result.success)) && (
               <div className="p-10 sm:p-14 text-center">
                 <div className="relative mb-10 inline-block">
                    <div className="absolute inset-0 bg-red-500/10 rounded-full scale-[1.8] blur-2xl animate-pulse" />
                    <div className="relative size-24 bg-red-500 rounded-[2rem] flex items-center justify-center shadow-2xl shadow-red-500/30 transform -rotate-6">
                      <span className="material-symbols-outlined text-white text-5xl font-bold">report</span>
                    </div>
                 </div>
                 <h1 className="text-slate-900 text-3xl font-black leading-tight mb-4 tracking-tight">¡Oops! Error</h1>
                 <p className="text-red-500 text-sm font-bold bg-red-50 rounded-2xl p-6 border-2 border-red-100 mb-10 leading-relaxed shadow-sm">
                   {!result?.success ? result?.error : 'No se pudo completar el proceso. Intente de nuevo.'}
                 </p>
                 <button onClick={reset} className="w-full bg-slate-100 hover:bg-slate-200 text-slate-600 font-black py-5 rounded-2xl transition-all active:scale-[0.98] text-xs tracking-widest uppercase">Volver a Intentar</button>
               </div>
            )}

            {/* Custom Message */}
            {(uiState === 'idle' || uiState === 'linking') && initialCustomMessage && (
               <div className="bg-slate-50/50 border-t border-slate-50 px-10 py-6 text-center">
                 <p className="text-[11px] font-medium text-slate-400 italic leading-relaxed">&ldquo;{initialCustomMessage}&rdquo;</p>
               </div>
            )}
          </div>

          <div className="mt-8 flex justify-center gap-8 text-white/30 text-[10px] font-bold uppercase tracking-widest">
            <a href="#" className="hover:text-white transition-colors">Soporte Técnico</a>
            <a href="#" className="hover:text-white transition-colors">Privacidad</a>
          </div>
        </div>
      </main>

      {/* --- FOOTER --- */}
      <footer className="w-full py-8 text-center px-6 z-10">
        <p className="text-white/20 text-[10px] font-black tracking-[0.2em] uppercase">
          © {new Date().getFullYear()} {kioskData?.company_name || initialCompanyName || 'Gestor360 HR Solutions'}
          <br/>
          <span className="opacity-50 tracking-[0.5em] mt-2 block">Premium HR Integration</span>
        </p>
      </footer>

      <Link 
        href="/login"
        className="absolute bottom-6 right-6 size-10 flex items-center justify-center text-white/10 hover:text-white/40 transition-all z-20"
        title="Acceso administrativo"
      >
        <span className="material-symbols-outlined text-xl">admin_panel_settings</span>
      </Link>
    </div>
  )
}
