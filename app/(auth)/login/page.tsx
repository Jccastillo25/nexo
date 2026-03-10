import Link from 'next/link'

export default function LoginPage() {
  return (
    <main className="min-h-screen bg-slate-100 px-4 py-10">
      <div className="mx-auto max-w-6xl rounded-[32px] bg-white shadow-sm ring-1 ring-slate-200 lg:grid lg:grid-cols-[1.1fr_480px]">
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
              <p className="text-sm text-white/70">Módulos</p>
              <p className="mt-2 text-lg font-semibold">
                Dashboard, asistencia, empleados, horarios, permisos y reportes
              </p>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/10 p-5 backdrop-blur">
              <p className="text-sm text-white/70">Acceso rápido</p>
              <p className="mt-2 text-lg font-semibold">
                Enfocado en operación diaria y control visual
              </p>
            </div>
          </div>
        </section>

        <section className="p-6 md:p-10">
          <div className="mx-auto max-w-md">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-400">
              Acceso
            </p>
            <h2 className="mt-3 text-4xl font-bold text-slate-900">
              Iniciar sesión
            </h2>
            <p className="mt-3 text-sm leading-6 text-slate-500">
              Esta pantalla es visual. Si ya tienes login funcional, no copies este archivo.
            </p>

            <form className="mt-8 space-y-5">
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  Correo electrónico
                </label>
                <input
                  type="email"
                  placeholder="correo@empresa.com"
                  className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none transition focus:border-slate-300"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  Contraseña
                </label>
                <input
                  type="password"
                  placeholder="••••••••"
                  className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none transition focus:border-slate-300"
                />
              </div>

              <Link
                href="/dashboard"
                className="flex h-12 w-full items-center justify-center rounded-2xl bg-slate-900 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                Entrar al panel visual
              </Link>

              <Link
                href="/"
                className="flex h-12 w-full items-center justify-center rounded-2xl border border-slate-200 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Volver al kiosko
              </Link>
            </form>
          </div>
        </section>
      </div>
    </main>
  )
}
