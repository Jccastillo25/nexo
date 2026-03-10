'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const router = useRouter()
  const supabase = createClient()

  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState<string | null>(null)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError(error.message === 'Invalid login credentials'
        ? 'Correo o contraseña incorrectos.'
        : error.message)
      setLoading(false)
      return
    }

    router.push('/dashboard')
    router.refresh()
  }

  return (
    <div className="auth-form-wrap">
      <div className="auth-form-header">
        <h2>Iniciar sesión</h2>
        <p>Ingresa tus credenciales para continuar</p>
      </div>

      <form onSubmit={handleLogin} className="auth-form">
        <div className="field">
          <label htmlFor="email">Correo electrónico</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="tu@correo.com"
            required
            autoComplete="email"
          />
        </div>

        <div className="field">
          <label htmlFor="password">Contraseña</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="••••••••"
            required
            autoComplete="current-password"
          />
        </div>

        {error && <p className="form-error">{error}</p>}

        <button type="submit" className="btn-primary" disabled={loading}>
          {loading ? 'Ingresando…' : 'Iniciar sesión'}
        </button>
      </form>

      <p className="auth-link">
        ¿No tienes cuenta?{' '}
        <Link href="/registro">Crear cuenta</Link>
      </p>

      <style>{`
        .auth-form-wrap {
          width: 100%; max-width: 380px;
        }
        .auth-form-header { margin-bottom: 2rem; }
        .auth-form-header h2 {
          font-size: 1.625rem; font-weight: 700;
          color: var(--gray-900); margin-bottom: .375rem;
        }
        .auth-form-header p { color: var(--gray-500); font-size: .9375rem; }

        .auth-form { display: flex; flex-direction: column; gap: 1.125rem; }

        .field { display: flex; flex-direction: column; gap: .375rem; }
        .field label {
          font-size: .8125rem; font-weight: 600;
          color: var(--gray-700); letter-spacing: .01em;
        }
        .field input {
          padding: .65rem .875rem;
          border: 1.5px solid var(--gray-200);
          border-radius: var(--radius);
          font-size: .9375rem;
          outline: none; transition: border-color .15s;
          background: var(--gray-50);
        }
        .field input:focus {
          border-color: var(--brand-500);
          background: white;
        }

        .form-error {
          font-size: .8125rem; color: var(--danger);
          background: #fef2f2; border: 1px solid #fecaca;
          padding: .5rem .75rem; border-radius: var(--radius-sm);
        }

        .btn-primary {
          margin-top: .25rem;
          padding: .75rem 1rem;
          background: var(--brand-600);
          color: white; border: none;
          border-radius: var(--radius);
          font-size: .9375rem; font-weight: 600;
          cursor: pointer; transition: background .15s;
        }
        .btn-primary:hover:not(:disabled) { background: var(--brand-700); }
        .btn-primary:disabled { opacity: .6; cursor: not-allowed; }

        .auth-link {
          margin-top: 1.5rem; text-align: center;
          font-size: .875rem; color: var(--gray-500);
        }
        .auth-link a { color: var(--brand-600); font-weight: 600; text-decoration: none; }
        .auth-link a:hover { text-decoration: underline; }
      `}</style>
    </div>
  )
}

export const dynamic = 'force-dynamic'
