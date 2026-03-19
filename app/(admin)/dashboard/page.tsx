import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { AttendanceChart } from './_components/attendance-chart'
import { TopDelaysChart } from './_components/top-delays-chart'
import { AttendanceDonut } from './_components/attendance-donut'
import { 
  Users, 
  Clock, 
  AlertTriangle, 
  Calendar, 
  Check, 
  X, 
  ArrowUpRight, 
  ArrowDownRight, 
  Bell,
  Search,
  ChevronRight,
  Info
} from 'lucide-react'

function fmt(n: number | null | undefined): string {
  if (n === null || n === undefined) return '—'
  return n.toLocaleString('es-NI')
}export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ company_id?: string }>
}) {
  const supabase = await createClient()
  const params = await searchParams
  const company_id = params.company_id

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  // Fetch all authorized company IDs for the user
  const { data: memberships } = await supabase
    .from('company_memberships')
    .select('company_id')
    .eq('user_id', user.id)
    .eq('is_active', true)

  const authorizedIds = memberships?.map(m => m.company_id) || []
  
  // Decide target filtering
  const filteringAll = !company_id || company_id === 'all'
  const targetId = filteringAll ? null : company_id

  // Helper to apply company filter
  const applyFilter = (query: any) => {
    if (targetId) {
      return query.eq('company_id', targetId)
    }
    return query.in('company_id', authorizedIds)
  }

  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const todayISO = todayStart.toISOString()

  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
  const sevenDaysAgoISO = sevenDaysAgo.toISOString()

  const startOfMonth = new Date()
  startOfMonth.setDate(1)
  startOfMonth.setHours(0, 0, 0, 0)
  const startOfMonthISO = startOfMonth.toISOString()

  const [
    { count: activeEmployees },
    { count: todayCheckins },
    { count: pendingCorrections },
    { count: pendingLeave },
    { data: recentRecords },
    { data: weeklyRecords },
    { data: monthlyDelaysData },
    { data: branches },
    { data: employeesWithBranch },
    { data: realPendingRequests },
  ] = await Promise.all([
    applyFilter(supabase.from('employees').select('*', { count: 'exact', head: true }).eq('is_active', true)),
    applyFilter(supabase.from('time_records').select('*', { count: 'exact', head: true }).eq('event_type', 'clock_in').gte('recorded_at', todayISO)),
    applyFilter(supabase.from('time_corrections').select('*', { count: 'exact', head: true }).eq('status', 'pending')),
    applyFilter(supabase.from('leave_requests').select('*', { count: 'exact', head: true }).eq('status', 'pending')),
    applyFilter(supabase.from('time_records').select('id, event_type, recorded_at, tardiness_minutes, employees(first_name, last_name, photo_url)').order('recorded_at', { ascending: false }).limit(4)),
    applyFilter(supabase.from('time_records').select('recorded_at').eq('event_type', 'clock_in').gte('recorded_at', sevenDaysAgoISO)),
    applyFilter(supabase.from('time_records').select('employee_id, tardiness_minutes, employees(first_name, last_name)').gte('recorded_at', startOfMonthISO).gt('tardiness_minutes', 0)),
    applyFilter(supabase.from('branches').select('id, name')),
    applyFilter(supabase.from('employees').select('branch_id').eq('is_active', true)),
    applyFilter(supabase.from('leave_requests').select('id, type, status, employees(first_name, last_name)').eq('status', 'pending').limit(3)),
  ])

  const fullName = user.user_metadata?.full_name || user.email?.split('@')[0] || 'Usuario'
  const role = (user.user_metadata?.role || 'Administrador').toUpperCase()

  // --- TRANSFORMATION: Weekly Attendance ---
  const dayLabels = ['Dom', 'Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab']
  const wr: any = weeklyRecords
  const weeklyChartData = Array.from({ length: 7 }, (_, i) => {
    const date = new Date()
    date.setDate(date.getDate() - (6 - i))
    const label = dayLabels[date.getDay()]
    const iso = date.toISOString().split('T')[0]
    const count = wr?.filter((r: any) => r.recorded_at.startsWith(iso)).length || 0
    return { name: label, total: activeEmployees || 0, value: count }
  })

  // --- TRANSFORMATION: Top Delays ---
  const delayMap: Record<string, { name: string; minutes: number }> = {}
  const mdd: any = monthlyDelaysData
  mdd?.forEach((r: any) => {
    const emp = r.employees
    const name = emp ? `${emp.first_name} ${emp.last_name}` : 'Empleado'
    if (!delayMap[r.employee_id]) {
        delayMap[r.employee_id] = { name, minutes: 0 }
    }
    delayMap[r.employee_id].minutes += (r.tardiness_minutes || 0)
  })
  const topDelays = Object.values(delayMap)
    .sort((a: any, b: any) => b.minutes - a.minutes)
    .slice(0, 3)
    .map((d: any, i: number) => ({ ...d, color: i === 0 ? '#ef4444' : i === 1 ? '#f59e0b' : '#fcd34d' }))

  // --- TRANSFORMATION: Branch Distribution ---
  const branchMap: Record<string, number> = {}
  const ewb: any = employeesWithBranch
  ewb?.forEach((e: any) => {
    if (e.branch_id) {
       branchMap[e.branch_id] = (branchMap[e.branch_id] || 0) + 1
    }
  })
  const brs: any = branches
  const distribution = brs?.map((b: any, i: number) => {
    const colors = ['bg-blue-500', 'bg-emerald-500', 'bg-orange-500', 'bg-purple-500']
    return {
      name: b.name,
      count: branchMap[b.id] || 0,
      total: activeEmployees || 0,
      color: colors[i % colors.length]
    }
  }).slice(0, 4) || []

  // --- TRANSFORMATION: Pending Requests ---
  const prs: any = realPendingRequests
  const pendingRequests = prs?.map((req: any) => {
    const emp = req.employees
    const name = emp ? `${emp.first_name} ${emp.last_name}` : 'Empleado'
    const initials = emp ? `${emp.first_name[0]}${emp.last_name[0]}` : '??'
    const colors: Record<string, string> = {
        'VACACIONES': 'bg-blue-500/10 text-blue-400',
        'PERMISO MEDICO': 'bg-orange-500/10 text-orange-400',
        'DIA ADMINISTRATIVO': 'bg-purple-500/10 text-purple-400'
    }
    return {
      name,
      type: (req.type || 'PERMISO').toUpperCase(),
      initials,
      color: colors[req.type] || 'bg-slate-500/10 text-slate-400'
    }
  }) || []

  const stats = [
    {
      label: 'Total Colaboradores',
      value: fmt(activeEmployees),
      trend: 'Activos',
      trendUp: true,
      icon: <Users className="w-5 h-5" />,
      color: 'primary'
    },
    {
      label: 'Asistencia Actual',
      value: fmt(todayCheckins),
      trend: `${activeEmployees ? Math.round((todayCheckins! / activeEmployees) * 100) : 0}% Hoy`,
      trendUp: true,
      icon: <Clock className="w-5 h-5 text-blue-400" />,
      color: 'blue'
    },
    {
      label: 'Correcciones',
      value: fmt(pendingCorrections),
      trend: 'Pendientes',
      trendUp: false,
      icon: <AlertTriangle className="w-5 h-5 text-orange-400" />,
      color: 'orange'
    },
    {
      label: 'Permisos Pendientes',
      value: fmt(pendingLeave),
      trend: (pendingLeave || 0).toString(),
      trendUp: false,
      isBadge: true,
      icon: <Calendar className="w-5 h-5 text-purple-400" />,
      color: 'purple'
    },
  ]

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-700 pt-2">
      
      {/* ── GRID LAYOUT ── */}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_380px] gap-6">
        
        {/* LEFT COLUMN: Main Stats & Charts */}
        <div className="space-y-6">
          
          {/* Stats Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {stats.map((stat, i) => (
              <div key={i} className="app-surface p-5 relative overflow-hidden group cursor-pointer hover:border-slate-500 transition-all">
                <div className="flex justify-between items-start mb-4">
                  <div className={`size-10 rounded-xl flex items-center justify-center bg-slate-800/50 border border-slate-700 group-hover:border-slate-500 transition-all`}>
                    {stat.icon}
                  </div>
                  {stat.isBadge ? (
                    <span className="size-5 rounded-full bg-red-500 text-[10px] font-black text-white flex items-center justify-center shadow-lg shadow-red-500/20">
                      {stat.trend}
                    </span>
                  ) : (
                    <div className={`flex items-center gap-1 text-[10px] font-black uppercase tracking-tighter ${stat.trendUp ? 'text-emerald-400' : 'text-orange-400'}`}>
                      {stat.trend} {stat.trendUp ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                    </div>
                  )}
                </div>
                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest leading-none mb-2">{stat.label}</p>
                <p className="text-3xl font-black text-white tracking-tight">{stat.value}</p>
              </div>
            ))}
          </div>

          {/* Large Main Chart Card */}
          <div className="app-surface p-8">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h2 className="text-xl font-black text-white tracking-tight">Resumen de Asistencia</h2>
                <p className="text-xs font-medium text-slate-500 mt-1 uppercase tracking-widest">Frecuencia semanal de ingresos y salidas</p>
              </div>
              <div className="flex items-center gap-4">
                <button className="px-4 py-2 bg-slate-800 border border-slate-700 rounded-xl text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-white transition-colors">
                  Últimos 7 días
                </button>
              </div>
            </div>
            <AttendanceChart data={weeklyChartData} />
          </div>

          {/* Bottom Row inside main column */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
             {/* Recent Activity */}
             <div className="app-surface p-6">
                <div className="flex items-center justify-between mb-8">
                   <h2 className="text-base font-black text-white tracking-tight uppercase">Actividad Reciente</h2>
                </div>
                <div className="space-y-6">
                   {recentRecords?.map((record: any, i: number) => {
                     const emp = record.employees as unknown as { first_name: string; last_name: string; photo_url?: string }
                     const name = emp ? `${emp.first_name} ${emp.last_name}` : 'Usuario'
                     const isIn = record.event_type === 'clock_in'
                     const action = isIn ? 'marcó entrada' : 'marcó salida'
                     const color = isIn ? 'bg-emerald-500' : 'bg-blue-500'
                     const diff = Math.floor((new Date().getTime() - new Date(record.recorded_at).getTime()) / 60000)
                     const timeLabel = diff < 60 ? `HACE ${diff} MIN` : diff < 1440 ? `HACE ${Math.floor(diff/60)} HORAS` : 'HACE MUCHO'
                     return (
                        <div key={i} className="flex gap-4 group">
                           <div className="flex flex-col items-center gap-2">
                              <div className={`size-2.5 rounded-full ${color} shadow-lg ring-4 ring-slate-800/10 transition-transform group-hover:scale-125`} />
                              {i < (recentRecords?.length || 0) - 1 && <div className="w-0.5 flex-grow bg-slate-800" />}
                           </div>
                           <div className="pb-6">
                              <p className="text-sm font-bold text-slate-300 leading-none">
                                <span className="text-white">{name}</span> {action}.
                              </p>
                              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1.5 opacity-60">{timeLabel}</p>
                           </div>
                        </div>
                     )
                   })}
                   <button className="w-full py-3 bg-slate-800 rounded-xl text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] hover:text-white transition-all border border-slate-700/50 hover:border-slate-500">
                      Ver historial
                   </button>
                </div>
             </div>

             {/* Distribution / Donut */}
             <div className="grid grid-rows-[1fr_auto] gap-6">
                <div className="app-surface p-6">
                   <div className="flex items-center justify-between mb-4">
                      <h2 className="text-base font-black text-white tracking-tight uppercase">Distribución de Personal</h2>
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest leading-none">POR SUCURSAL</span>
                   </div>
                   <div className="space-y-4">
                      {distribution.map((dept: any, i: number) => (
                        <div key={i} className="space-y-2">
                           <div className="flex justify-between text-[10px] font-black uppercase tracking-wider text-slate-300">
                              <span>{dept.name}</span>
                              <span className="text-white">{dept.count}</span>
                           </div>
                           <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                              <div className={`h-full ${dept.color} rounded-full`} style={{ width: `${(dept.count/dept.total)*100}%` }} />
                           </div>
                        </div>
                      ))}
                      {distribution.length === 0 && (
                        <div className="text-center py-10 text-xs text-slate-500 uppercase tracking-widest">Sin sucursales</div>
                      )}
                   </div>
                </div>

                <div className="app-surface p-6">
                   <div className="flex items-center justify-between mb-2">
                      <h2 className="text-base font-black text-white tracking-tight uppercase">Estado de Asistencia</h2>
                      <span className="flex items-center gap-1.5 text-[9px] font-black text-emerald-400 uppercase tracking-widest ring-1 ring-emerald-500/20 px-2 py-0.5 rounded-full bg-emerald-500/5">
                        <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" /> EN VIVO
                      </span>
                   </div>
                   <AttendanceDonut present={todayCheckins || 0} total={activeEmployees || 0} />
                </div>
             </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Sidebar Widgets */}
        <div className="space-y-6">
          
          {/* Top Atrasos */}
          <div className="app-surface p-6">
             <div className="flex items-center justify-between mb-6">
                <h2 className="text-base font-black text-white tracking-tight uppercase">Top Atrasos (Mensual)</h2>
                <AlertTriangle className="w-4 h-4 text-orange-400" />
             </div>
             <TopDelaysChart delays={topDelays} />
             <button className="w-full mt-8 py-3 bg-slate-800 rounded-xl text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] hover:text-white transition-all border border-slate-700/50 hover:border-slate-500">
                Ver reporte completo
             </button>
          </div>

          {/* Pending Requests */}
          <div className="app-surface p-6">
             <div className="flex items-center justify-between mb-8">
                <h2 className="text-base font-black text-white tracking-tight uppercase">Solicitudes Pendientes</h2>
             </div>
             <div className="space-y-4">
                {pendingRequests.map((req: any, i: number) => (
                  <div key={i} className="flex items-center justify-between p-3 rounded-2xl bg-slate-800/40 border border-slate-700/30">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-slate-700 text-xs font-black flex items-center justify-center border border-slate-600">
                        {req.initials}
                      </div>
                      <div>
                        <p className="text-xs font-bold text-white leading-tight">{req.name}</p>
                        <p className={`text-[8px] font-black mt-1 px-1.5 py-0.5 rounded inline-block uppercase tracking-widest ${req.color}`}>
                          {req.type}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-1.5">
                      <button className="size-8 rounded-lg bg-emerald-500/10 text-emerald-500 flex items-center justify-center hover:bg-emerald-500 hover:text-white transition-all border border-emerald-500/20">
                        <Check className="w-4 h-4" />
                      </button>
                      <button className="size-8 rounded-lg bg-red-500/10 text-red-500 flex items-center justify-center hover:bg-red-500 hover:text-white transition-all border border-red-500/20">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
             </div>
             <button className="w-full mt-6 py-3 bg-slate-800 rounded-xl text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] hover:text-white transition-all border border-slate-700/50 hover:border-slate-500">
                Ver más
             </button>
          </div>

          {/* Reminder Box */}
          <div className="app-surface p-6 bg-gradient-to-br from-blue-600/10 to-indigo-600/10 border-blue-500/20">
             <div className="flex items-center gap-3 mb-4">
                <div className="size-8 rounded-lg bg-blue-500 flex items-center justify-center shadow-lg shadow-blue-500/30">
                  <Info className="w-4 h-4 text-white" />
                </div>
                <h3 className="text-xs font-black text-blue-400 uppercase tracking-[0.2em]">RECORDATORIO</h3>
             </div>
             <p className="text-sm font-bold text-slate-300 leading-relaxed mb-4">
                Cierre de mes programado para mañana. Revise las marcaciones pendientes.
             </p>
          </div>

        </div>

      </div>

      {/* Floating Kiosko shortcut for small screens */}
      <Link 
        href="/"
        className="fixed bottom-6 right-6 lg:hidden size-14 rounded-2xl bg-blue-500 shadow-2xl shadow-blue-500/40 flex items-center justify-center text-white z-50 transition-transform active:scale-95"
      >
        <span className="material-symbols-outlined text-3xl">clock_loader_60</span>
      </Link>
    </div>
  )
}
