'use client'

import React, { useEffect } from 'react'
import { AlertTriangle } from 'lucide-react'

interface DirtyStateGuardProps {
  show: boolean
  onConfirm: () => void // "Descartar y salir"
  onCancel: () => void  // "Seguir editando"
}

export function DirtyStateGuard({ show, onConfirm, onCancel }: DirtyStateGuardProps) {
  if (!show) return null

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md animate-in fade-in duration-300">
      <div className="w-full max-w-md bg-white rounded-[40px] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.4)] overflow-hidden animate-in zoom-in-95 duration-200 ring-1 ring-black/5">
        
        <div className="p-10">
          <div className="flex flex-col items-center text-center space-y-8">
            <div className="h-24 w-24 rounded-[32px] bg-amber-50 flex items-center justify-center text-amber-500 shadow-inner">
               <AlertTriangle size={48} strokeWidth={2.5} />
            </div>
            
            <div className="space-y-3">
              <h2 className="text-3xl font-black text-slate-900 tracking-tight leading-tight">
                ¿Deseas descartar los cambios?
              </h2>
              <p className="text-sm font-bold text-slate-500 leading-relaxed px-6">
                Tienes modificaciones sin guardar. Si sales ahora, toda la información ingresada se perderá permanentemente.
              </p>
            </div>
          </div>
        </div>

        <div className="p-8 pt-0 flex flex-col gap-3">
          <button
            onClick={onCancel}
            autoFocus
            className="h-16 w-full rounded-2xl bg-slate-900 text-white text-[15px] font-black shadow-2xl shadow-slate-200 hover:bg-slate-800 active:scale-[0.98] transition-all flex items-center justify-center gap-2 uppercase tracking-widest"
          >
            Seguir editando
          </button>
          
          <button
            onClick={onConfirm}
            className="h-14 w-full rounded-2xl text-[13px] font-black text-slate-400 hover:text-red-600 hover:bg-red-50 transition-all flex items-center justify-center uppercase tracking-widest"
          >
            Descartar y salir
          </button>
        </div>
      </div>
    </div>
  )
}
