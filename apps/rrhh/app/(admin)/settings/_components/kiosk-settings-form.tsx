'use client'

import { useState } from 'react'
import { saveSetting } from '../../../actions/appearance'

interface KioskSettingsFormProps {
  customMessage: string | null
}

export function KioskSettingsForm({ customMessage }: KioskSettingsFormProps) {
  const [message, setMessage] = useState(customMessage ?? 'Gracias por su puntualidad')
  const [loading, setLoading] = useState(false)
  const [status, setStatus]     = useState<'idle' | 'success' | 'error'>('idle')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setStatus('idle')

    const res = await saveSetting('kiosk_custom_message', message)
    
    setLoading(false)
    if (res.success) {
      setStatus('success')
      setTimeout(() => setStatus('idle'), 3000)
    } else {
      setStatus('error')
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="mb-2 block text-sm font-semibold text-slate-900">
          Mensaje Personalizado en Kiosko
        </label>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Ej: Gracias por su puntualidad, ¡tengan un excelente día!"
          rows={3}
          className="w-full rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
        />
        <p className="mt-2 text-xs text-slate-400">
          Este mensaje aparecerá en la parte inferior de la pantalla de marcación del empleado.
        </p>
      </div>

      <div className="flex items-center justify-between pt-2">
        <div className="text-xs">
          {status === 'success' && <span className="font-semibold text-green-600">✓ Cambios guardados</span>}
          {status === 'error' && <span className="font-semibold text-red-600">⚠ Error al guardar</span>}
        </div>
        <button
          type="submit"
          disabled={loading}
          className="flex h-10 items-center justify-center rounded-xl bg-slate-900 px-6 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-50"
        >
          {loading ? 'Guardando...' : 'Guardar mensaje'}
        </button>
      </div>
    </form>
  )
}
