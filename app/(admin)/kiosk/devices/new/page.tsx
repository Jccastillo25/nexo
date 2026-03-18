'use client'

import { useState, useEffect } from 'react'
import { registerKioskDevice } from '@/app/actions/kiosk'
import { createClient } from '@/lib/supabase/client'
import { redirect, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft, Monitor, MapPin, Keyboard, Info } from 'lucide-react'

export default function NewKioskDevicePage() {
  const router = useRouter()
  const [branches, setBranches] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchBranches() {
      const supabase = createClient()
      const { data } = await supabase
        .from('branches')
        .select('id, name, companies(display_name)')
        .eq('is_active', true)
        .order('name')
      
      if (data) setBranches(data)
      setLoading(false)
    }
    fetchBranches()
  }, [])

  async function handleSubmit(formData: FormData) {
    setSubmitting(true)
    setError(null)
    
    const branchId = formData.get('branchId') as string
    const name = formData.get('name') as string
    const location = formData.get('location') as string
    const notes = formData.get('notes') as string

    const result = await registerKioskDevice(branchId, name, location, notes)
    
    if (result.error) {
      setError(result.error)
      setSubmitting(false)
    } else {
      router.push('/kiosk/devices')
    }
  }

  if (loading) return <div className="p-8 text-center text-slate-500 animate-pulse">Cargando sucursales...</div>

  return (
    <div className="max-w-2xl mx-auto p-4 md:p-8">
      <Link href="/kiosk/devices" className="inline-flex items-center text-sm font-medium text-slate-500 hover:text-indigo-600 transition-colors mb-6 group">
        <ChevronLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" /> Volver a Dispositivos
      </Link>

      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="p-8 md:p-10">
          <div className="flex items-center gap-4 mb-8">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-lg shadow-indigo-200 dark:shadow-none">
              <Monitor className="h-8 w-8" />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">Nuevo Dispositivo</h1>
              <p className="text-slate-500 dark:text-slate-400">Configure un nuevo punto de marcación</p>
            </div>
          </div>

          <form action={handleSubmit} className="space-y-6">
            {error && (
              <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-900/50 text-rose-700 dark:text-rose-400 text-sm flex items-center gap-2">
                <Info className="w-4 h-4 flex-shrink-0" />
                {error}
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700 dark:text-slate-300 ml-1 flex items-center gap-2">
                <MapPin className="w-4 h-4 opacity-50" /> Sucursal Destino *
              </label>
              <select
                name="branchId"
                required
                className="w-full h-12 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-4 text-sm focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all appearance-none cursor-pointer font-medium"
              >
                <option value="">Selecciona una sucursal</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({b.companies?.display_name})
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700 dark:text-slate-300 ml-1 flex items-center gap-2">
                <Monitor className="w-4 h-4 opacity-50" /> Nombre del Dispositivo *
              </label>
              <input
                name="name"
                type="text"
                required
                placeholder="Ej: Tablet Recepción, Samsung Tab S8"
                className="w-full h-12 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-4 text-sm focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all font-medium"
              />
              <p className="text-[11px] text-slate-400 ml-1">Para identificarlo internamente (ej: Tablet de Alondra)</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700 dark:text-slate-300 ml-1 flex items-center gap-2">
                  <Keyboard className="w-4 h-4 opacity-50" /> Ubicación
                </label>
                <input
                  name="location"
                  type="text"
                  placeholder="Ej: Entrada Principal, Planta 2"
                  className="w-full h-12 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-4 text-sm focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all font-medium"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700 dark:text-slate-300 ml-1 flex items-center gap-2">
                  <Info className="w-4 h-4 opacity-50" /> Notas adicionales
                </label>
                <input
                  name="notes"
                  type="text"
                  placeholder="Cualquier aclaración..."
                  className="w-full h-12 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-4 text-sm focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all font-medium"
                />
              </div>
            </div>

            <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-900/30 rounded-2xl p-4 flex gap-3">
              <Info className="w-5 h-5 text-amber-600 dark:text-amber-500 shrink-0 mt-0.5" />
              <p className="text-sm text-amber-800 dark:text-amber-400 leading-relaxed">
                <span className="font-bold">Nota:</span> El código del dispositivo se generará automáticamente siguiendo el formato de la empresa y la sucursal. No podrá ser editado manualmente más adelante.
              </p>
            </div>

            <div className="flex gap-4 pt-6">
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 inline-flex items-center justify-center rounded-xl bg-indigo-600 px-8 py-3.5 text-sm font-black text-white shadow-xl shadow-indigo-200 dark:shadow-none transition-all hover:bg-indigo-500 active:scale-95 disabled:opacity-50"
              >
                {submitting ? 'Creando...' : 'Generar y Guardar'}
              </button>
              <Link
                href="/kiosk/devices"
                className="inline-flex items-center justify-center rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-8 py-3.5 text-sm font-bold text-slate-900 dark:text-white transition-all hover:bg-slate-50 dark:hover:bg-slate-800 active:scale-95"
              >
                Cancelar
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
