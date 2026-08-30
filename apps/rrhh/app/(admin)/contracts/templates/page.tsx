import Link from 'next/link';

export default function TemplatesPage() {
  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 space-y-8 animate-in fade-in zoom-in-95 duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Plantillas Legales</h1>
          <p className="text-sm font-bold text-slate-500 uppercase tracking-widest mt-1">Configuración del Motor Legal</p>
        </div>
        <Link 
          href="/contracts/templates/new"
          className="rounded-2xl bg-slate-900 px-6 py-3.5 text-sm font-bold text-white shadow-xl shadow-slate-900/20 transition hover:bg-slate-800 active:scale-95"
        >
          Crear Plantilla
        </Link>
      </div>

      <div className="bg-slate-50 border border-slate-200 rounded-3xl p-12 text-center shadow-inner">
        <svg className="mx-auto h-12 w-12 text-slate-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
        <h3 className="text-lg font-black text-slate-900 mb-2">Módulo en Construcción</h3>
        <p className="text-sm font-medium text-slate-500">
          El listado de plantillas está en desarrollo. El generador PDF utilizará la plantilla Maestra Nicaragüense por defecto hasta que se complete este módulo.
        </p>
      </div>
    </div>
  );
}
