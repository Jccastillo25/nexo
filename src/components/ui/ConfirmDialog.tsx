'use client'

import React from 'react'
import { AlertCircle, CheckCircle2, X, ShieldAlert } from 'lucide-react'

interface ConfirmDialogProps {
  isOpen: boolean
  title: string
  description: string
  confirmLabel?: string
  cancelLabel?: string
  onConfirm: () => void
  onCancel: () => void
  variant?: 'danger' | 'info' | 'success' | 'warning'
}

export function ConfirmDialog({
  isOpen,
  title,
  description,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  onConfirm,
  onCancel,
  variant = 'info'
}: ConfirmDialogProps) {
  if (!isOpen) return null

  const variantStyles = {
    danger:  'bg-red-500 text-white hover:bg-red-600 shadow-[0_0_20px_rgba(239,68,68,0.3)]',
    warning: 'bg-amber-500 text-white hover:bg-amber-600 shadow-[0_0_20px_rgba(245,158,11,0.3)]',
    info:    'bg-[var(--primary)] text-white hover:bg-[var(--primary-hover)] shadow-[0_0_20px_var(--primary-soft)]',
    success: 'bg-emerald-500 text-white hover:bg-emerald-600 shadow-[0_0_20px_rgba(16,185,129,0.3)]'
  }

  const Icon = variant === 'danger' ? ShieldAlert : variant === 'success' ? CheckCircle2 : AlertCircle

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 cursor-default"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      aria-describedby="confirm-dialog-desc"
    >
      {/* Backdrop con Blur y Fade-in */}
      <div
        className="absolute inset-0 bg-[var(--bg-app)]/80 backdrop-blur-2xl animate-in fade-in duration-500"
        onClick={onCancel}
        aria-hidden="true"
      />

      {/* Modal Card con Zoom-in y Alta Definición */}
      <div className="relative w-full max-w-lg bg-[var(--bg-surface)] border border-white/10 rounded-[40px] shadow-[0_32px_64px_-12px_rgba(0,0,0,0.9)] overflow-hidden animate-in zoom-in-95 duration-300 ease-out">
        {/* Línea de acento superior */}
        <div className={`h-1.5 w-full ${
          variant === 'danger'  ? 'bg-red-500' :
          variant === 'warning' ? 'bg-amber-500' :
          variant === 'success' ? 'bg-emerald-500' : 'bg-[var(--primary)]'
        }`} />
        
        <div className="p-10">
          <div className="flex flex-col items-center text-center space-y-6">
            <div className={`p-5 rounded-[25px] ${
              variant === 'danger'  ? 'bg-red-500/10 text-red-400' :
              variant === 'warning' ? 'bg-amber-500/10 text-amber-400' :
              variant === 'success' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-[var(--primary-soft)] text-[var(--primary)]'
            }`}>
              <Icon className="h-10 w-10" />
            </div>
            
            <div className="space-y-3">
              <h3 id="confirm-dialog-title" className="text-3xl font-black text-white tracking-tight leading-tight">
                {title}
              </h3>
              <p id="confirm-dialog-desc" className="text-sm font-medium text-white/50 leading-relaxed max-w-sm mx-auto">
                {description}
              </p>
            </div>
          </div>

          <div className="mt-12 flex flex-col sm:flex-row gap-4">
            <button
              type="button"
              onClick={onConfirm}
              className={`flex-1 py-4 px-6 rounded-3xl text-[11px] font-black tracking-[0.2em] uppercase transition-all active:scale-95 ${variantStyles[variant]}`}
            >
              {confirmLabel}
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 py-4 px-6 bg-transparent text-white/40 text-[11px] font-black tracking-[0.2em] uppercase rounded-3xl hover:bg-white/5 hover:text-white transition-all active:scale-95 border border-white/5"
            >
              {cancelLabel}
            </button>
          </div>
        </div>
        
        {/* Close Button X */}
        <button
          type="button"
          onClick={onCancel}
          aria-label="Cerrar"
          className="absolute top-8 right-8 p-2 text-white/20 hover:text-white transition-colors"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
    </div>
  )
}
