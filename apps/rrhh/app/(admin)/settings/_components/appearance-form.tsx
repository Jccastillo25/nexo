'use client'

import { useRef, useState, useTransition } from 'react'
import { createClient } from '@/lib/supabase/client'
import { saveSetting } from '../../../actions/appearance'

interface UploadCardProps {
  label: string
  description: string
  settingKey: string
  currentUrl: string | null
  accept: string
  storagePath: string
  previewRound?: boolean
}

function UploadCard({
  label,
  description,
  settingKey,
  currentUrl,
  accept,
  storagePath,
  previewRound,
}: UploadCardProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<string | null>(currentUrl)
  const [status, setStatus] = useState<'idle' | 'uploading' | 'ok' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')
  const [isPending, startTransition] = useTransition()

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setStatus('uploading')
    setErrorMsg('')

    const supabase = createClient()
    const ext = file.name.split('.').pop()
    const path = `${storagePath}.${ext}`

    const { error: uploadError } = await supabase.storage
      .from('branding')
      .upload(path, file, { upsert: true, contentType: file.type })

    if (uploadError) {
      setStatus('error')
      setErrorMsg(uploadError.message)
      return
    }

    const { data: { publicUrl } } = supabase.storage
      .from('branding')
      .getPublicUrl(path)

    // Add cache-bust so browser picks up new image immediately
    const urlWithBust = `${publicUrl}?t=${Date.now()}`
    setPreview(urlWithBust)

    startTransition(async () => {
      const result = await saveSetting(settingKey, publicUrl)
      if (result?.error) {
        setStatus('error')
        setErrorMsg(result.error)
      } else {
        setStatus('ok')
      }
    })
  }

  const handleRemove = () => {
    startTransition(async () => {
      setStatus('uploading')
      await saveSetting(settingKey, null)
      setPreview(null)
      setStatus('idle')
      if (inputRef.current) inputRef.current.value = ''
    })
  }

  return (
    <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-slate-900">{label}</p>
          <p className="mt-1 text-xs text-slate-500">{description}</p>
        </div>
        {preview && (
          <button
            type="button"
            onClick={handleRemove}
            disabled={isPending || status === 'uploading'}
            className="shrink-0 text-xs text-slate-400 underline-offset-2 hover:text-red-500 hover:underline disabled:opacity-40"
          >
            Eliminar
          </button>
        )}
      </div>

      <div className="mt-5 flex items-center gap-5">
        {/* Preview */}
        <div
          className={`flex h-20 w-20 shrink-0 items-center justify-center border-2 border-dashed border-slate-200 bg-slate-50 ${
            previewRound ? 'rounded-full' : 'rounded-2xl'
          } overflow-hidden`}
        >
          {preview ? (
            <img
              src={preview}
              alt={label}
              className="h-full w-full object-contain"
            />
          ) : (
            <span className="text-2xl text-slate-300">+</span>
          )}
        </div>

        {/* Upload button */}
        <div className="flex-1">
          <input
            ref={inputRef}
            type="file"
            accept={accept}
            className="hidden"
            onChange={handleFile}
          />
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={status === 'uploading' || isPending}
            className="rounded-2xl border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {status === 'uploading' || isPending ? 'Subiendo…' : 'Seleccionar archivo'}
          </button>
          <p className="mt-2 text-xs text-slate-400">
            {accept.includes('svg') ? 'PNG, SVG, JPG — máx. 5 MB' : 'PNG, JPG, ICO — máx. 5 MB'}
          </p>

          {status === 'ok' && (
            <p className="mt-2 text-xs font-semibold text-emerald-600">✓ Guardado correctamente</p>
          )}
          {status === 'error' && (
            <p className="mt-2 text-xs font-semibold text-red-600">{errorMsg || 'Error al subir'}</p>
          )}
        </div>
      </div>
    </div>
  )
}

interface AppearanceFormProps {
  logoUrl: string | null
  faviconUrl: string | null
  kioskBgUrl: string | null
}

export function AppearanceForm({ logoUrl, faviconUrl, kioskBgUrl }: AppearanceFormProps) {
  return (
    <div className="space-y-4">
      <UploadCard
        label="Logo de la empresa"
        description="Se muestra en el sidebar del panel administrativo y en el kiosko de marcación."
        settingKey="logo_url"
        currentUrl={logoUrl}
        accept="image/png,image/jpeg,image/svg+xml,image/webp"
        storagePath="logo"
        previewRound={false}
      />
      <UploadCard
        label="Favicon"
        description="Icono que aparece en la pestaña del navegador. Recomendado: PNG o ICO de 32×32 px."
        settingKey="favicon_url"
        currentUrl={faviconUrl}
        accept="image/png,image/x-icon,image/vnd.microsoft.icon,image/jpeg"
        storagePath="favicon"
        previewRound={true}
      />
      <UploadCard
        label="Fondo del kiosko"
        description="Imagen de fondo para la pantalla de marcación de empleados. Recomendado: 1920×1080 px."
        settingKey="kiosk_bg_url"
        currentUrl={kioskBgUrl}
        accept="image/png,image/jpeg,image/webp"
        storagePath="kiosk-bg"
        previewRound={false}
      />
    </div>
  )
}
