'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

interface KioskClientProps {
  logoUrl: string | null
  kioskBgUrl: string | null
}

export function KioskClient({ logoUrl, kioskBgUrl }: KioskClientProps) {
  const [pin, setPin] = useState('')
  const [time, setTime] = useState('')
  const [date, setDate] = useState('')

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
    if (pin.length >= 4) return
    setPin((prev) => prev + digit)
  }

  const clearPin = () => setPin('')
  const submitPin = () => {
    if (pin.length !== 4) return
    alert(`PIN ingresado: ${pin}`)
  }

  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9']

  return (
    <main
      className="min-h-screen flex flex-col"
      style={
        kioskBgUrl
          ? {
              backgroundImage: `url(${kioskBgUrl})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }
          : { backgroundColor: '#020617' /* slate-950 */ }
      }
    >
      {/* Overlay when there is a background image */}
      {kioskBgUrl && (
        <div className="absolute inset-0 bg-black/50" />
      )}

      <div className="relative flex flex-col flex-1">
        {/* Topbar */}
        <header className="flex items-center justify-between px-8 py-5">
          <div className="flex items-center gap-3">
            {logoUrl ? (
              <img src={logoUrl} alt="Logo" className="h-8 w-auto object-contain" />
            ) : (
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                  Grupo CT
                </p>
                <p className="mt-0.5 text-sm font-semibold text-slate-300">
                  Sistema de Control de Asistencia
                </p>
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
              <p className="text-6xl font-bold tabular-nums text-white tracking-tight">
                {time}
              </p>
              <p className="mt-2 text-sm capitalize text-slate-400">{date}</p>
              <p className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-slate-700 bg-slate-800/80 px-3 py-1 text-xs font-semibold text-slate-400 backdrop-blur">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                SUC 02 – Ferretería La Máxima
              </p>
            </div>

            {/* Card */}
            <div className="rounded-3xl bg-white p-8 shadow-2xl">

              <h2 className="text-center text-2xl font-bold text-slate-900">
                Ingrese su PIN
              </h2>
              <p className="mt-1.5 text-center text-sm text-slate-500">
                PIN de 4 dígitos para marcar asistencia
              </p>

              {/* PIN indicators */}
              <div className="mt-6 grid grid-cols-4 gap-3">
                {[0, 1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className={`h-14 rounded-2xl border-2 text-2xl font-bold leading-[3.25rem] text-center transition-colors ${
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
              <div className="mt-6 grid grid-cols-3 gap-3">
                {keys.map((key) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => addDigit(key)}
                    className="h-14 rounded-2xl bg-slate-100 text-2xl font-bold text-slate-900 transition hover:bg-slate-200 active:scale-95"
                  >
                    {key}
                  </button>
                ))}

                <button
                  type="button"
                  onClick={clearPin}
                  className="h-14 rounded-2xl border border-slate-200 text-sm font-semibold text-slate-500 transition hover:bg-slate-100 active:scale-95"
                >
                  Borrar
                </button>

                <button
                  type="button"
                  onClick={() => addDigit('0')}
                  className="h-14 rounded-2xl bg-slate-100 text-2xl font-bold text-slate-900 transition hover:bg-slate-200 active:scale-95"
                >
                  0
                </button>

                <button
                  type="button"
                  onClick={submitPin}
                  disabled={pin.length !== 4}
                  className="h-14 rounded-2xl bg-slate-900 text-sm font-bold text-white transition hover:bg-slate-800 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Marcar
                </button>
              </div>
            </div>

          </div>
        </div>
      </div>
    </main>
  )
}
