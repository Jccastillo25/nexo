'use client'

import React from 'react'
import { AlertTriangle, X } from 'lucide-react'

interface DirtyStateGuardProps {
  show: boolean
  onConfirm: () => void // "Descartar y salir"
  onCancel: () => void  // "Seguir editando"
}

export function DirtyStateGuard({ show, onConfirm, onCancel }: DirtyStateGuardProps) {
  if (!show) return null

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300">
      <div className="w-full max-w-md bg-white rounded-[40px] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.3)] overflow-hidden animate-in zoom-in-95 duration-300 ring-1 ring-black/5">
        
        <div className="p-8 pt-10">
          <div className="flex flex-col items-center text-center space-y-6">
            <div className="h-20 w-20 rounded-[30px] bg-amber-50 flex items-center justify-center text-amber-500 shadow-inner">
               <AlertTriangle size={40} strokeWidth={2.5} />
            </div>
            
            <div className="space-y-2">
              <h2 className="text-2xl font-black text-slate-900 tracking-tight">
                Cambios pendientes
              </h2>
              <p className="text-sm font-medium text-slate-500 leading-relaxed px-4">
                Tienes cambios sin guardar. Si cierras esta ventana ahora, perderás toda la información ingresada. ¿Deseas salir de todos modos?
              </p>
            </div>
          </div>
        </div>

        <div className="p-8 bg-slate-50 flex flex-col gap-3">
          <button
            onClick={onCancel}
            autoFocus
            className="h-14 w-full rounded-2xl bg-slate-900 text-white text-[15px] font-black shadow-xl shadow-slate-200 hover:bg-slate-800 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
          >
            Seguir editando
          </button>
          
          <button
            onClick={onConfirm}
            className="h-12 w-full rounded-2xl text-[14px] font-bold text-slate-400 hover:text-red-600 hover:bg-red-50 transition-all flex items-center justify-center"
          >
            Descartar y salir
          </button>
        </div>
      </div>
    </div>
  )
}
