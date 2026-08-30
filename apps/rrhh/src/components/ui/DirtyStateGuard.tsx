'use client'

import React from 'react'
import { AlertTriangle } from 'lucide-react'

interface DirtyStateGuardProps {
  show: boolean
  onConfirm: () => void // "Descartar y salir"
  onCancel: () => void  // "Seguir editando"
}

export function DirtyStateGuard({ show, onConfirm, onCancel }: DirtyStateGuardProps) {
  if (!show) return null

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-[var(--bg-app)]/80 backdrop-blur-md animate-in fade-in duration-300"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="dirty-guard-title"
      aria-describedby="dirty-guard-desc"
    >
      <div className="w-full max-w-md bg-[var(--bg-surface)] rounded-[40px] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.8)] overflow-hidden animate-in zoom-in-95 duration-200 ring-1 ring-white/10">

        <div className="p-10">
          <div className="flex flex-col items-center text-center space-y-8">
            <div className="h-24 w-24 rounded-[32px] bg-amber-500/10 flex items-center justify-center text-amber-400 shadow-inner ring-1 ring-amber-500/20">
               <AlertTriangle size={48} strokeWidth={2.5} />
            </div>

            <div className="space-y-3">
              <h2 id="dirty-guard-title" className="text-3xl font-black text-[var(--text-strong)] tracking-tight leading-tight">
                ¿Deseas descartar los cambios?
              </h2>
              <p id="dirty-guard-desc" className="text-sm font-bold text-[var(--text-muted)] leading-relaxed px-6">
                Tienes modificaciones sin guardar. Si sales ahora, toda la información ingresada se perderá permanentemente.
              </p>
            </div>
          </div>
        </div>

        <div className="p-8 pt-0 flex flex-col gap-3">
          <button
            onClick={onCancel}
            autoFocus
            className="h-16 w-full rounded-2xl bg-[var(--primary)] text-white text-[15px] font-black hover:bg-[var(--primary-hover)] active:scale-[0.98] transition-all flex items-center justify-center gap-2 uppercase tracking-widest shadow-[0_0_20px_rgba(13,127,242,0.3)]"
          >
            Seguir editando
          </button>

          <button
            onClick={onConfirm}
            className="h-14 w-full rounded-2xl text-[13px] font-black text-[var(--text-muted)] hover:text-red-400 hover:bg-red-500/10 transition-all flex items-center justify-center uppercase tracking-widest"
          >
            Descartar y salir
          </button>
        </div>
      </div>
    </div>
  )
}
