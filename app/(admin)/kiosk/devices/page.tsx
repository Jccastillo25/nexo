'use client'

import { useState, useEffect } from 'react'
import { getKioskDevices, deleteKioskDevice, updateKioskDevice } from '../../../actions/kiosk'
import Link from 'next/link'
import { 
  Monitor, 
  MapPin, 
  Calendar, 
  Copy, 
  Edit2, 
  Trash2, 
  Plus, 
  ChevronLeft,
  CheckCircle2,
  XCircle
} from 'lucide-react'

export default function KioskDevicesPage() {
  const [devices, setDevices] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [copySuccess, setCopySuccess] = useState<string | null>(null)
  
  // Edit State
  const [editingDevice, setEditingDevice] = useState<any | null>(null)
  const [isUpdating, setIsUpdating] = useState(false)

  useEffect(() => {
    fetchDevices()
  }, [])

  async function fetchDevices() {
    setLoading(true)
    const { data, error } = await getKioskDevices()
    if (data) setDevices(data)
    setLoading(false)
  }

  const handleCopy = (code: string) => {
    navigator.clipboard.writeText(code)
    setCopySuccess(code)
    setTimeout(() => setCopySuccess(null), 2000)
  }

  const handleDelete = async (id: string) => {
    if (confirm('¿Estás seguro de que deseas eliminar este dispositivo?')) {
      await deleteKioskDevice(id)
      fetchDevices()
    }
  }

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingDevice) return
    
    setIsUpdating(true)
    const res = await updateKioskDevice(editingDevice.id, {
      name: editingDevice.name,
      location: editingDevice.location,
      notes: editingDevice.notes,
      is_active: editingDevice.is_active
    })
    
    setIsUpdating(false)
    if (res.success) {
      setEditingDevice(null)
      fetchDevices()
    } else {
      alert('Error updating device: ' + res.error)
    }
  }

  if (loading) {
    return <div className="p-8 text-center text-muted-foreground animate-pulse">Cargando dispositivos...</div>
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4 md:p-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Link href="/organization" className="text-primary hover:underline text-sm flex items-center gap-1">
              <ChevronLeft className="w-4 h-4" /> Regresar
            </Link>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">Dispositivos Kiosko</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">Gestionar dispositivos de marcación por sucursal</p>
        </div>
        <Link
          href="/kiosk/devices/new"
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-indigo-500 hover:shadow-indigo-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
        >
          <Plus className="w-4 h-4" /> Nuevo Dispositivo
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {devices.map((device) => (
          <div 
            key={device.id} 
            className="group relative flex flex-col rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm transition-all hover:shadow-md hover:border-indigo-200 dark:hover:border-indigo-900/50"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400">
                  <Monitor className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-white group-hover:text-indigo-600 transition-colors">
                    {device.name || 'Dispositivo sin nombre'}
                  </h3>
                  <code className="text-xs font-mono text-slate-400 uppercase tracking-tighter">
                    {device.device_code}
                  </code>
                </div>
              </div>
              <div className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${device.is_active ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'}`}>
                {device.is_active ? (
                  <><CheckCircle2 className="w-3 h-3" /> Activo</>
                ) : (
                  <><XCircle className="w-3 h-3" /> Inactivo</>
                )}
              </div>
            </div>

            <div className="space-y-2.5 text-sm mb-6">
              <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
                <MapPin className="w-4 h-4 opacity-50" />
                <span><span className="font-semibold text-slate-700 dark:text-slate-300">Sucursal:</span> {device.branch_name}</span>
              </div>
              {device.location && (
                <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
                  <Monitor className="w-4 h-4 opacity-50" />
                  <span><span className="font-semibold text-slate-700 dark:text-slate-300">Ubicación:</span> {device.location}</span>
                </div>
              )}
              <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
                <Calendar className="w-4 h-4 opacity-50" />
                <span>
                  <span className="font-semibold text-slate-700 dark:text-slate-300">Última actividad:</span>{' '}
                  {device.last_seen ? new Date(device.last_seen).toLocaleString() : 'Nunca'}
                </span>
              </div>
            </div>

            <div className="mt-auto flex items-center gap-2 pt-4 border-t border-slate-100 dark:border-slate-800">
              <button
                onClick={() => handleCopy(device.device_code)}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 px-3 py-2 text-xs font-semibold text-indigo-700 dark:text-indigo-400 transition-colors hover:bg-indigo-100 dark:hover:bg-indigo-900/40"
              >
                {copySuccess === device.device_code ? (
                  <>¡Copiado!</>
                ) : (
                  <><Copy className="w-3 h-3" /> Copiar Código</>
                )}
              </button>
              <button
                onClick={() => setEditingDevice(device)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 dark:border-slate-800 text-slate-400 hover:text-indigo-600 hover:border-indigo-200 dark:hover:border-indigo-900 transition-all"
                title="Editar"
              >
                <Edit2 className="h-4 w-4" />
              </button>
              <button
                onClick={() => handleDelete(device.id)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 dark:border-slate-800 text-slate-400 hover:text-rose-600 hover:border-rose-200 dark:hover:border-rose-900 transition-all"
                title="Eliminar"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}

        {devices.length === 0 && (
          <div className="col-span-full rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800 p-12 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-slate-50 dark:bg-slate-900 text-slate-400 mb-4">
              <Monitor className="h-8 w-8" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Sin dispositivos registrados</h3>
            <p className="text-slate-500 dark:text-slate-400 mt-2 max-w-xs mx-auto">
              Crea un nuevo dispositivo para empezar a usar el kiosko en tus sucursales.
            </p>
            <Link
              href="/kiosk/devices/new"
              className="mt-6 inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-indigo-500"
            >
              <Plus className="w-4 h-4" /> Agregar primer dispositivo
            </Link>
          </div>
        )}
      </div>

      {/* Edit Modal */}
      {editingDevice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="absolute inset-0 bg-slate-950/40" onClick={() => setEditingDevice(null)} />
          <div className="relative w-full max-w-lg rounded-3xl bg-white dark:bg-slate-900 p-8 shadow-2xl animate-in zoom-in-95">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-6">Editar Dispositivo</h2>
            <form onSubmit={handleUpdate} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Nombre del Dispositivo</label>
                <input
                  type="text"
                  value={editingDevice.name || ''}
                  onChange={(e) => setEditingDevice({ ...editingDevice, name: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 p-3 text-sm focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none transition"
                  placeholder="Ej: Tablet Recepción"
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Ubicación física</label>
                <input
                  type="text"
                  value={editingDevice.location || ''}
                  onChange={(e) => setEditingDevice({ ...editingDevice, location: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 p-3 text-sm focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none transition"
                  placeholder="Ej: Lobby entrada principal"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Notas</label>
                <textarea
                  value={editingDevice.notes || ''}
                  onChange={(e) => setEditingDevice({ ...editingDevice, notes: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 p-3 text-sm focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none transition"
                  rows={3}
                  placeholder="Información adicional..."
                />
              </div>
              <div className="flex items-center gap-3 py-2">
                <button
                  type="button"
                  onClick={() => setEditingDevice({ ...editingDevice, is_active: !editingDevice.is_active })}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${editingDevice.is_active ? 'bg-indigo-600' : 'bg-slate-200 dark:bg-slate-700'}`}
                >
                  <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${editingDevice.is_active ? 'translate-x-5' : 'translate-x-0'}`} />
                </button>
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Dispositivo Activo</span>
              </div>
              
              <div className="flex gap-3 mt-8">
                <button
                  type="button"
                  onClick={() => setEditingDevice(null)}
                  className="flex-1 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 text-sm font-bold text-slate-600 dark:text-slate-300 transition hover:bg-slate-200 dark:hover:bg-slate-700"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isUpdating}
                  className="flex-1 h-12 rounded-2xl bg-indigo-600 text-sm font-bold text-white shadow-lg transition hover:bg-indigo-500 disabled:opacity-50"
                >
                  {isUpdating ? 'Guardando...' : 'Guardar Cambios'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
