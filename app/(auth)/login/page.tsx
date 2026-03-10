'use client'

import { useActionState } from 'react'
import { signIn, type AuthState } from '../../actions/auth'

export default function LoginPage() {
  const [state, action, pending] = useActionState<AuthState, FormData>(signIn, null)

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-10">
      <div className="mx-auto max-w-6xl rounded-[32px] bg-white shadow-sm ring-1 ring-slate-200 lg:grid lg:grid-cols-[1.1fr_480px]">

        {/* Panel izquierdo */}
        <section className="hidden min-h-[680px] rounded-l-[32px] bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-700 p-10 text-white lg:flex lg:flex-col lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-white/60">
              Grupo CT
            </p>
            <h1 className="mt-4 text-5xl font-bold leading-tight">
              Área administrativa
            </h1>
            <p className="mt-6 max-w-md text-base leading-7 text-white/75">
              Administra asistencia, empleados, horarios, permisos y reportes
              desde un solo panel.
            </p>
          </div>

          <div className="grid gap-4">
            <div className="rounded-3xl border border-white/10 bg-white/10 p-5 backdrop-blur">
              <p className="text-sm text-white/70">Módulos activos</p>
              <p className="mt-2 text-lg font-semibold">
                Dashboard · Asistencia · Empleados · Horarios · Permisos
              </p>
            </div>
            <div className="rounded-3xl border border-white/10 bg-white/10 p-5 backdrop-blur">
              <p className="text-sm text-white/70">Sistema</p>
              <p className="mt-2 text-lg font-semibold">
                Control de acceso por roles · Auditoría completa
              </p>
            </div>
          </div>
        </section>

        {/* Formulario */}
        <section className="p-6 md:p-10">
          <div className="mx-auto max-w-md">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-400">
              Acceso
            </p>
            <h2 className="mt-3 text-4xl font-bold text-slate-900">
              Iniciar sesión
            </h2>
            <p className="mt-3 text-sm leading-6 text-slate-500">
              Ingresa con tu cuenta de administrador de Grupo CT.
            </p>

            <form action={action} className="mt-8 space-y-5">
              {state?.error && (
                <div className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-600 ring-1 ring-red-200">
                  {state.error}
                </div>
              )}

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  Correo electrónico
                </label>
                <input
                  type="email"
                  name="email"
                  placeholder="correo@empresa.com"
                  required
                  className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  Contraseña
                </label>
                <input
                  type="password"
                  name="password"
                  placeholder="••••••••"
                  required
                  className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
                />
              </div>

              <button
                type="submit"
                disabled={pending}
                className="flex h-12 w-full items-center justify-center rounded-2xl bg-slate-900 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {pending ? 'Verificando…' : 'Entrar al panel'}
              </button>

              <a
                href="/"
                className="flex h-12 w-full items-center justify-center rounded-2xl border border-slate-200 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Volver al kiosko
              </a>
            </form>
          </div>
        </section>
      </div>
    </main>
  )
}
