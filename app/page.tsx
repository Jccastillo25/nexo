'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'

export default function KioskPage() {
  const [pin, setPin] = useState('')

  const timeText = useMemo(() => {
    return new Intl.DateTimeFormat('es-NI', {
      hour: 'numeric',
      minute: '2-digit',
    }).format(new Date())
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
    <main className="min-h-screen bg-gradient-to-br from-blue-500 to-violet-600 px-4 py-6 text-white">
      <div className="mx-auto flex max-w-6xl items-start justify-between">
        <div />
        <div className="text-center">
          <h1 className="text-4xl font-bold">Marcación Grupo CT</h1>
          <p className="mt-2 text-xl text-white/90">Sistema de Control de Asistencia</p>
          <p className="mt-3 text-sm font-semibold text-white/90">
            • SUC 02 – Ferretería La Máxima
          </p>
        </div>

        <Link
          href="/login"
          className="rounded-xl border border-white/30 bg-white/10 px-5 py-3 text-sm font-semibold text-white backdrop-blur hover:bg-white/20"
        >
          Área Administrativa
        </Link>
      </div>

      <section className="mx-auto mt-10 max-w-md rounded-[28px] bg-white p-8 text-center text-slate-900 shadow-2xl">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full border-4 border-blue-400 text-3xl text-blue-500">
          🕒
        </div>

        <h2 className="text-4xl font-bold tracking-tight">Ingrese su PIN</h2>
        <p className="mt-3 text-base text-slate-500">
          Use su PIN de 4 dígitos para marcar asistencia
        </p>

        <p className="mt-5 text-3xl font-bold text-blue-500">{timeText}</p>

        <div className="mt-8 grid grid-cols-4 gap-3">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-16 rounded-2xl border-2 border-slate-200 bg-slate-50 text-2xl font-bold leading-[4rem]"
            >
              {pin[i] ? '•' : ''}
            </div>
          ))}
        </div>

        <div className="mt-8 grid grid-cols-3 gap-3">
          {keys.map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => addDigit(key)}
              className="h-16 rounded-2xl bg-slate-100 text-3xl font-bold text-slate-900 transition hover:bg-slate-200"
            >
              {key}
            </button>
          ))}

          <button
            type="button"
            onClick={clearPin}
            className="h-16 rounded-2xl bg-red-100 text-2xl font-bold text-red-500 transition hover:bg-red-200"
          >
            C
          </button>

          <button
            type="button"
            onClick={() => addDigit('0')}
            className="h-16 rounded-2xl bg-slate-100 text-3xl font-bold text-slate-900 transition hover:bg-slate-200"
          >
            0
          </button>

          <button
            type="button"
            onClick={submitPin}
            className="h-16 rounded-2xl bg-blue-300 text-2xl font-bold text-white transition hover:bg-blue-400"
          >
            ✓
          </button>
        </div>
      </section>
    </main>
  )
}