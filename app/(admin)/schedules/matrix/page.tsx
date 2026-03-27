import { createClient } from '@/lib/supabase/server'
import PersonnelGrid from '../_components/PersonnelGrid'
import Link from 'next/link'
import { ArrowLeft, Search, Filter } from 'lucide-react'

export default async function MatrixPage({
  searchParams,
}: {
  searchParams: { branchId?: string; startDate?: string }
}) {
  const supabase = await createClient()

  // Fetch branches for filter
  const { data: userData } = await supabase.auth.getUser()
  const companyId = userData.user?.user_metadata?.company_id

  const { data: branches } = await supabase
    .from('branches')
    .select('id, name')
    .eq('company_id', companyId)
    .is('deleted_at', null)

  const selectedBranchId = searchParams.branchId || 'all'
  const startDate = searchParams.startDate || new Date().toISOString().split('T')[0]

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-2 text-slate-400 mb-2">
            <Link href="/schedules" className="hover:text-slate-600 transition">
              <ArrowLeft size={16} />
            </Link>
            <span className="text-[10px] font-black uppercase tracking-widest">Gestión de Turnos</span>
          </div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Matriz de Diagnóstico</h1>
          <p className="mt-2 text-sm text-slate-500 max-w-xl">
            Visualiza el origen de cada turno (Directo, Global o Sucursal) y realiza ajustes específicos por empleado.
          </p>
        </div>

        <div className="flex items-center gap-3 bg-white p-2 rounded-3xl shadow-sm ring-1 ring-slate-200">
           <div className="flex items-center gap-2 px-3 border-r border-slate-100">
              <Filter size={14} className="text-slate-400" />
              <select 
                className="text-xs font-bold bg-transparent border-none focus:ring-0 text-slate-700"
                defaultValue={selectedBranchId}
                // Note: In a real app, use a client component for navigation on change
              >
                <option value="all">Todas las sucursales</option>
                {branches?.map(b => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
           </div>
           <div className="flex items-center gap-2 px-3">
              <Search size={14} className="text-slate-400" />
              <input 
                type="date" 
                defaultValue={startDate}
                className="text-xs font-bold bg-transparent border-none focus:ring-0 text-slate-700"
              />
           </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-slate-900 rounded-3xl p-6 text-white shadow-xl shadow-slate-200">
            <h3 className="text-sm font-black uppercase tracking-widest opacity-60 mb-4">Leyenda de Herencia</h3>
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="h-4 w-4 rounded-md border-2 border-white bg-white/20" />
                <div>
                  <p className="text-xs font-bold">Manual / Fijo</p>
                  <p className="text-[10px] opacity-60">Asignado directamente</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="h-4 w-4 rounded-md border-2 border-dashed border-white/40" />
                <div>
                  <p className="text-xs font-bold">Heredado</p>
                  <p className="text-[10px] opacity-60">Desde Puesto o Sucursal</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                 <div className="flex h-4 w-4 items-center justify-center rounded-md bg-white text-slate-900">
                   <Link href="#" className="opacity-100"><ArrowLeft size={10} /></Link>
                 </div>
                 <div>
                  <p className="text-xs font-bold">Override</p>
                  <p className="text-[10px] opacity-60">Excepción para este día</p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-3xl p-6 ring-1 ring-slate-200">
             <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-4">Tips de Uso</h3>
             <ul className="text-[11px] text-slate-600 space-y-3">
               <li className="flex gap-2">
                 <span className="text-slate-900 font-bold">1.</span>
                 Pasa el mouse sobre un turno para ver su origen exacto.
               </li>
               <li className="flex gap-2">
                 <span className="text-slate-900 font-bold">2.</span>
                 Usa el botón "Fijar" para convertir una regla automática en manual.
               </li>
               <li className="flex gap-2">
                 <span className="text-slate-900 font-bold">3.</span>
                 Arrastra turnos desde la librería para crear excepciones rápidas.
               </li>
             </ul>
          </div>
        </div>

        <div className="lg:col-span-3">
          <PersonnelGrid 
            companyId={companyId} 
            branchId={selectedBranchId} 
            startDate={startDate} 
          />
        </div>
      </div>
    </div>
  )
}
