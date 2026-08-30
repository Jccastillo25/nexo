'use client'

import { Settings, Info, Bell, Shield, Sliders } from 'lucide-react'

export default function KioskSettingsPage() {
  return (
    <div className="max-w-4xl mx-auto p-4 md:p-8 space-y-8">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white flex items-center gap-3">
          <Settings className="w-8 h-8 text-indigo-600" />
          Configuración Kioscos
        </h1>
        <p className="text-slate-500 dark:text-slate-400 mt-2">
          Ajustes generales del comportamiento de los puntos de marcación.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {[
          { icon: <Bell className="w-5 h-5" />, title: 'Notificaciones', desc: 'Alertas sonoras al marcar.' },
          { icon: <Shield className="w-5 h-5" />, title: 'Seguridad', desc: 'Bloqueo de pantalla por inactividad.' },
          { icon: <Sliders className="w-5 h-5" />, title: 'Interfaz', desc: 'Temas y logos personalizados.' },
        ].map((item, i) => (
          <div key={i} className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm opacity-50 cursor-not-allowed group">
            <div className="flex items-center gap-4 mb-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-400">
                {item.icon}
              </div>
              <div>
                <h3 className="font-bold text-slate-900 dark:text-white">{item.title}</h3>
                <p className="text-xs text-slate-500">{item.desc}</p>
              </div>
            </div>
            <div className="mt-4 flex items-center justify-end">
              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-300">Próximamente</span>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/30 rounded-3xl p-6 flex gap-4">
        <Info className="w-6 h-6 text-amber-600 dark:text-amber-500 shrink-0" />
        <p className="text-sm text-amber-800 dark:text-amber-400 leading-relaxed font-medium">
          <span className="font-bold">Nota de Desarrollo:</span> Los ajustes de configuración avanzada se habilitarán en futuras actualizaciones. Por ahora, puede gestionar los mensajes y dispositivos desde sus respectivos submenús.
        </p>
      </div>
    </div>
  )
}
