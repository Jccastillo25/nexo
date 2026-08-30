import { Monitor, Info, ChevronRight } from 'lucide-react'
import Link from 'next/link'

export default function AssignKioskPage() {
  return (
    <div className="max-w-4xl mx-auto p-4 md:p-8 space-y-8">
      <div className="text-center space-y-4 max-w-2xl mx-auto">
        <div className="inline-flex h-20 w-20 items-center justify-center rounded-3xl bg-indigo-600 text-white shadow-2xl shadow-indigo-200 dark:shadow-none mb-4 animate-bounce">
          <Monitor className="h-10 w-10" />
        </div>
        <h1 className="text-4xl font-black tracking-tight text-slate-900 dark:text-white">Asignar Kiosko</h1>
        <p className="text-xl text-slate-500 dark:text-slate-400 leading-relaxed font-medium">
          Vincule un dispositivo físico (Tablet, PC, etc.) con el sistema de marcación.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
        <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 p-10 shadow-xl space-y-8">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 text-sm">1</span>
            Paso 1: Abrir Kiosko
          </h2>
          <p className="text-slate-600 dark:text-slate-400">
            En el dispositivo que desea usar como punto de marcación, abra el navegador y diríjase a la página principal del sistema.
          </p>
          <Link 
            href="/" 
            target="_blank"
            className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-100 dark:border-slate-700 transition-colors group"
          >
            <span className="font-mono text-xs font-bold text-slate-900 dark:text-slate-300">Ir a la Pantalla de Marcación</span>
            <ChevronRight className="w-4 h-4 text-indigo-600 transition-transform group-hover:translate-x-1" />
          </Link>
        </div>

        <div className="bg-indigo-600 rounded-[2.5rem] p-10 shadow-2xl shadow-indigo-200 dark:shadow-none space-y-8 text-white">
          <h2 className="text-2xl font-bold flex items-center gap-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-white text-sm">2</span>
            Paso 2: Vincular
          </h2>
          <p className="text-indigo-50 leading-relaxed">
            Si el dispositivo no está vinculado, aparecerá una pantalla pidiendo un <span className="font-black underline decoration-indigo-300 underline-offset-4">Código de Dispositivo</span>.
          </p>
          <div className="p-6 rounded-2xl bg-white/10 border border-white/20 space-y-4">
            <div className="flex items-center gap-3">
              <Info className="w-5 h-5 text-indigo-300" />
              <p className="text-sm font-semibold">¿Dónde obtengo mi código?</p>
            </div>
            <p className="text-xs text-indigo-100 leading-relaxed">
              Vaya a la sección de <Link href="/kiosk/devices" className="underline font-bold hover:text-white transition-colors">Dispositivos Kiosko</Link>, cree un nuevo registro para este dispositivo y copie el código generado automáticamente.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
