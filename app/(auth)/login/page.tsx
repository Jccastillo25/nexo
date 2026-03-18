'use client'

import { useActionState, useState, useRef } from 'react'
import { signIn, type AuthState } from '../../actions/auth'

export default function LoginPage() {
  const [state, action, pending] = useActionState<AuthState, FormData>(signIn, null)
  const [showConfirm, setShowConfirm] = useState(false)
  const formRef = useRef<HTMLFormElement>(null)

  const handleFormSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    if (!showConfirm) {
      e.preventDefault()
      setShowConfirm(true)
    }
  }

  return (
    <main className="bg-mesh relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10">
      <div className="relative mx-auto w-full max-w-[440px]">
        {/* Logo / Header Superior */}
        <div className="mb-8 flex items-center justify-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#0d7ff2]">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
            </svg>
          </div>
          <span className="text-lg font-bold tracking-wide text-white">Grupo CT</span>
        </div>

        {/* Tarjeta de Formulario */}
        <div className="rounded-[24px] bg-white px-8 py-10 shadow-[0_20px_50px_rgba(0,0,0,0.3)] ring-1 ring-white/10">
          <div className="mb-8 text-center">
            <h2 className="text-xl font-bold tracking-tight text-slate-900">Bienvenido a Grupo CT</h2>
            <p className="mt-1.5 text-xs text-slate-500">Inicie sesión para acceder a su panel de control</p>
          </div>

          <form 
            ref={formRef}
            action={action} 
            onSubmit={handleFormSubmit}
            className="space-y-5"
          >
            {state?.error && (
              <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600 ring-1 ring-red-200">
                {state.error}
              </div>
            )}

            <div className="space-y-1.5">
              <label className="ml-1 text-[13px] font-bold text-slate-700">
                Correo electrónico
              </label>
              <input
                type="email"
                name="email"
                placeholder="ejemplo@grupo-ct.com"
                required
                className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-[13px] font-medium outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/20"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between ml-1">
                <label className="text-[13px] font-bold text-slate-700">
                  Contraseña
                </label>
                <a href="#" className="text-[11px] font-bold text-[#0d7ff2] hover:underline">
                  ¿Olvidó su contraseña?
                </a>
              </div>
              <input
                type="password"
                name="password"
                placeholder="••••••••"
                required
                className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-[13px] font-medium outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/20"
              />
            </div>

            <div className="flex items-center gap-2 px-1 pt-1 pb-2">
              <input type="checkbox" id="remember" className="rounded text-[#0d7ff2] focus:ring-[#0d7ff2]" />
              <label htmlFor="remember" className="text-xs font-semibold text-slate-500 cursor-pointer">Mantener sesión iniciada</label>
            </div>

            <button
              type="submit"
              disabled={pending}
              className="flex h-12 w-full items-center justify-center rounded-xl bg-[#0d7ff2] text-sm font-bold text-white shadow-lg shadow-blue-500/30 transition hover:bg-[#0b6ed6] active:scale-[0.98] disabled:opacity-60"
            >
              {pending ? 'Verificando...' : 'Iniciar Sesión'}
            </button>
            
            <div className="mt-6 text-center">
              <p className="text-xs font-medium text-slate-500">
                ¿No tiene una cuenta? <a href="#" className="text-[#0d7ff2] hover:underline">Contacte con soporte</a>
              </p>
            </div>
          </form>
        </div>

        {/* Footer */}
        <div className="mt-8 flex flex-col items-center gap-2 text-[11px] font-medium text-slate-400/60">
          <div className="flex gap-4">
             <a href="#" className="hover:text-slate-300 transition">Términos de servicio</a>
             <a href="#" className="hover:text-slate-300 transition">Política de privacidad</a>
             <a href="#" className="hover:text-slate-300 transition">Ayuda</a>
          </div>
          <p>© {new Date().getFullYear()} Grupo CT por Grupo Castillo Torrez. Todos los derechos reservados.</p>
        </div>
      </div>

      {/* MODAL DE CONFIRMACIÓN (ESTILO PREMIUM GESTOR360) */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="absolute inset-0 bg-[#0f172a]/80 transition-opacity" onClick={() => setShowConfirm(false)} />
          
          <div className="relative w-full max-w-[400px] rounded-[24px] bg-white p-10 shadow-[0_20px_60px_rgba(0,0,0,0.4)] animate-in zoom-in-95 duration-200">
            <div className="mb-6 flex justify-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#0d7ff2] text-white shadow-lg shadow-blue-500/30">
                <svg className="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            </div>

            <h3 className="text-center text-[19px] font-bold tracking-tight text-slate-900">
              Confirmar inicio de sesión
            </h3>
            
            <p className="mt-3 text-center text-[13px] leading-relaxed text-slate-600">
              Usted está a punto de iniciar una sesión administrativa en el sistema <strong>Grupo CT</strong>. Por favor, confirme para continuar.
            </p>

            <div className="mt-8 grid gap-2.5">
              <button
                onClick={() => {
                  formRef.current?.requestSubmit()
                  setShowConfirm(false)
                }}
                className="flex h-11 w-full items-center justify-center rounded-xl bg-[#0d7ff2] text-[13px] font-bold text-white shadow-lg shadow-blue-500/30 transition hover:bg-[#0b6ed6] active:scale-[0.98]"
              >
                Sí, iniciar sesión
              </button>
              <button
                onClick={() => setShowConfirm(false)}
                className="flex h-11 w-full items-center justify-center rounded-xl bg-transparent text-[13px] font-bold text-slate-500 hover:text-slate-800 transition"
              >
                Cancelar
              </button>
            </div>
            
            <div className="mt-8 flex flex-col items-center justify-center border-t border-slate-100 pt-6">
                <p className="mb-2 text-[9px] font-bold uppercase tracking-widest text-slate-400">Desarrollado por</p>
                <div className="flex items-center gap-2 opacity-50 saturate-0">
                    <div className="flex h-4 w-4 items-center justify-center rounded bg-slate-800">
                        <span className="text-[8px] font-bold text-white">CT</span>
                    </div>
                    <span className="text-[11px] font-bold text-slate-800">Grupo Castillo Torrez</span>
                </div>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
