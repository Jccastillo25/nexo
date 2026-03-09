import { createClient } from '@/lib/supabase/server'

export default async function Home() {
  const supabase = await createClient()
  const { data, error } = await supabase.auth.getUser()

  const isMissingSession =
    error?.message?.toLowerCase().includes('auth session missing') ?? false

  const connectionStatus = !error || isMissingSession ? 'OK' : 'ERROR'

  return (
    <main className="min-h-screen flex items-center justify-center p-8">
      <div className="max-w-2xl w-full rounded-2xl border p-8 shadow-sm space-y-4">
        <h1 className="text-3xl font-semibold">Marcación Grupo CT</h1>
        <p className="text-sm text-neutral-600">
          Prueba inicial de conexión con Supabase
        </p>

        <div className="rounded-xl border p-4 space-y-2">
          <p>
            <strong>Estado del cliente Supabase:</strong> {connectionStatus}
          </p>

          <p>
            <strong>Usuario autenticado:</strong>{' '}
            {data?.user ? data.user.email : 'No autenticado'}
          </p>

          {isMissingSession && (
            <p className="text-sm text-amber-600">
              No existe sesión iniciada todavía. Esto es normal en esta etapa.
            </p>
          )}

          {error && !isMissingSession && (
            <pre className="text-sm text-red-600 whitespace-pre-wrap">
              {error.message}
            </pre>
          )}
        </div>
      </div>
    </main>
  )
}