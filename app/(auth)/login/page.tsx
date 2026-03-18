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
    <main className="min-h-screen bg-[#4f46e5] flex items-center justify-center px-4 py-10 relative overflow-hidden">
      {/* Fondo Decorativo Estilo Premium */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#6366f1] via-[#4f46e5] to-[#3b82f6]" />
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-white/10 rounded-full blur-3xl" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-400/20 rounded-full blur-3xl" />

      <div className="relative mx-auto w-full max-w-[480px]">
        {/* Logo / Header Superior */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-white shadow-xl">
             <span className="text-3xl font-black italic text-[#4f46e5]">M</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-white">
            Iniciar Sesión
          </h1>
          <p className="mt-2 text-white/70">
            Acceda a su cuenta de Marcación Grupo CT
          </p>
        </div>

        {/* Tarjeta de Formulario */}
        <div className="rounded-[32px] bg-white p-8 shadow-2xl ring-1 ring-white/20">
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-slate-900">Bienvenido</h2>
            <p className="mt-1 text-sm text-slate-500">Ingrese sus credenciales para continuar</p>
          </div>

          <form 
            ref={formRef}
            action={action} 
            onSubmit={handleFormSubmit}
            className="space-y-6"
          >
            {state?.error && (
              <div className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-600 ring-1 ring-red-200">
                {state.error}
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700 ml-1">
                Correo Electrónico
              </label>
              <input
                type="email"
                name="email"
                placeholder="ejemplo@correo.com"
                required
                className="h-14 w-full rounded-2xl border border-slate-100 bg-slate-50 px-5 text-sm outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-50"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700 ml-1">
                Contraseña
              </label>
              <input
                type="password"
                name="password"
                placeholder="••••••••"
                required
                className="h-14 w-full rounded-2xl border border-slate-100 bg-slate-50 px-5 text-sm outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-50"
              />
            </div>

            <button
              type="submit"
              disabled={pending}
              className="group relative flex h-14 w-full items-center justify-center overflow-hidden rounded-2xl bg-[#4f46e5] text-base font-bold text-white shadow-lg transition hover:bg-[#4338ca] active:scale-[0.98] disabled:opacity-60"
            >
              <span className="relative z-10 flex items-center gap-2">
                {pending ? 'Verificando...' : (
                  <>
                    Ingresar
                    <svg className="h-4 w-4 transition-transform group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                  </>
                )}
              </span>
            </button>

            <div className="text-center">
              <p className="text-xs text-slate-400 font-medium tracking-wide">
                ¿Olvidó su contraseña? Contacte al administrador del sistema
              </p>
            </div>
          </form>
        </div>

        {/* Footer */}
        <p className="mt-8 text-center text-xs text-white/50 font-medium">
          © {new Date().getFullYear()} Grupo CT. Todos los derechos reservados.
        </p>
      </div>

      {/* MODAL DE CONFIRMACIÓN (ESTILO PREMIUM) */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-md">
          <div className="absolute inset-0 bg-slate-900/60" onClick={() => setShowConfirm(false)} />
          
          <div className="relative w-full max-w-sm rounded-[32px] bg-white p-8 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="mb-6 flex justify-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-50 text-blue-600 ring-8 ring-blue-50/50">
                <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            </div>

            <h3 className="text-center text-2xl font-bold text-slate-900">
              Confirmar inicio de sesión
            </h3>
            
            <p className="mt-4 text-center text-sm leading-relaxed text-slate-600">
              ¿Está seguro de que desea iniciar sesión en el área administrativa?
            </p>
            
            <p className="mt-4 rounded-2xl bg-slate-50 p-4 text-center text-xs leading-relaxed text-slate-500 italic border border-slate-100">
              "Esta acción iniciará una sesión administrativa en este dispositivo y reemplazará cualquier sesión previa existente."
            </p>

            <div className="mt-8 grid gap-3">
              <button
                onClick={() => {
                  formRef.current?.requestSubmit()
                  setShowConfirm(false)
                }}
                className="flex h-12 w-full items-center justify-center rounded-2xl bg-[#4f46e5] text-sm font-bold text-white shadow-md transition hover:bg-[#4338ca] active:scale-[0.98]"
              >
                Sí, iniciar sesión
              </button>
              <button
                onClick={() => setShowConfirm(false)}
                className="flex h-12 w-full items-center justify-center rounded-2xl bg-slate-50 text-sm font-bold text-slate-600 transition hover:bg-slate-100"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
