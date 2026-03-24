'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { adminNav } from './admin-nav'
import { useGlobalContext } from '@/context/GlobalContext'

interface AdminTopbarProps {
  sidebarOpen: boolean
  onToggleSidebar: () => void
  onMobileMenuOpen: () => void
  userName?: string
  userRole?: string
  companyName?: string
  logoUrl?: string | null
  companies?: { id: string, name: string, slug: string }[]
}

export function AdminTopbar({
  sidebarOpen,
  onToggleSidebar,
  onMobileMenuOpen,
  userName = 'Admin',
  userRole = 'Administrador',
  companyName = 'Gestor360',
  logoUrl,
  companies = [],
}: AdminTopbarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { companyId, setCompanyId } = useGlobalContext()

  const isDashboard = pathname === '/dashboard'
  
  const initials = userName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase()

  // Dynamic Title Logic
  const getDynamicTitle = () => {
    // Exact or direct match from nav
    for (const section of adminNav) {
      for (const item of section.items) {
        // Strip query params for comparison
        const itemPath = item.href.split('?')[0]
        if (pathname === itemPath) return item.label
      }
    }

    // Special cases for sub-routes
    if (pathname.startsWith('/employees/')) {
      if (pathname.includes('/edit')) return 'Editar Colaborador'
      if (pathname.includes('/new')) return 'Nuevo Colaborador'
      return 'Perfil de Colaborador'
    }
    
    if (pathname.startsWith('/organization/')) return 'Organización'
    if (pathname.startsWith('/attendance/')) return 'Marcaciones'
    if (pathname.startsWith('/schedules/')) return 'Horarios'
    if (pathname.startsWith('/reports/')) return 'Reportes'
    if (pathname.startsWith('/kiosk/')) return 'Kiosko'
    if (pathname.startsWith('/leave/')) return 'Permisos y Ausencias'
    if (pathname.startsWith('/settings/')) return 'Configuración'
    if (pathname.startsWith('/security/')) return 'Seguridad'
    if (pathname.startsWith('/contracts/')) return 'Contrataciones'
    if (pathname.startsWith('/monitor')) return 'Monitor Operativo'

    return 'Panel de Control'
  }

  const pageTitle = getDynamicTitle()

  // Context-based company change (can be called from other components if selector is added back)
  const handleCompanyChange = (id: string) => {
    setCompanyId(id)
  }

  return (
    <header
      className="print:hidden sticky top-0 z-20 border-b transition-all duration-300"
      style={{
        background: 'rgba(15, 23, 42, 0.9)',
        backdropFilter: 'blur(16px)',
        borderColor: 'var(--border-soft)',
        height: 'clamp(64px, 10vh, 80px)',
      }}
    >
      <div className="flex h-full items-center gap-2 px-3 md:gap-4 md:px-6 overflow-hidden">

        {/* ── Left: Logo + Hamburger + Title ── */}
        <div className="flex items-center gap-2 md:gap-4 min-w-0">

          {/* Hamburger / Sidebar Toggles */}
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={onToggleSidebar}
              className="hidden lg:flex h-9 w-9 items-center justify-center rounded-lg transition-colors text-slate-400 hover:text-white hover:bg-slate-800"
              title={sidebarOpen ? 'Ocultar menú' : 'Mostrar menú'}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </button>

            <button
              onClick={onMobileMenuOpen}
              className="flex lg:hidden h-9 w-9 items-center justify-center rounded-lg transition-colors text-slate-400 active:bg-slate-800"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </button>
          </div>

          {/* Title Branding + Company Selector */}
          <div className="flex flex-col ml-0.5 min-w-0">
            <div className="flex items-center gap-1.5 mb-1">
              <span className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] hidden sm:block truncate opacity-70">
                Organización Actual:
              </span>
              {companies.length > 1 ? (
                <select 
                  value={companyId || ''} 
                  onChange={(e) => handleCompanyChange(e.target.value)}
                  className="bg-transparent text-[10px] font-black text-blue-400 uppercase tracking-widest outline-none cursor-pointer hover:text-blue-300 transition-colors"
                >
                   <option value="all" className="bg-slate-900 text-white">Todas las empresas</option>
                   {companies.map(c => (
                     <option key={c.id} value={c.id} className="bg-slate-900 text-white">{c.name}</option>
                   ))}
                </select>
              ) : (
                <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest">
                  {companyName}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 md:gap-4 truncate">
              <h1 className="text-sm md:text-xl font-black text-white tracking-tight leading-none shrink-0">{pageTitle}</h1>
              <div className="w-px h-4 bg-slate-700/50 hidden xs:block" />
              {isDashboard && <span className="shrink-0 px-1.5 py-0.5 bg-blue-500/10 text-blue-400 text-[8px] md:text-[9px] font-black rounded uppercase border border-blue-500/20">ADMIN</span>}
            </div>
          </div>
        </div>

        {/* ── Spacer ── */}
        <div className="flex-1" />

        {/* ── Right: Search + Notifications + Profile ── */}
        <div className="flex items-center gap-2 md:gap-4 shrink-0 px-1">
          {/* Search bar - Solo en pantallas grandes */}
          <div className="relative hidden xl:block group">
            <svg
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-blue-400 transition-colors"
              viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            >
              <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
            </svg>
            <input
              type="text"
              placeholder="Buscar..."
              className="h-10 w-44 rounded-xl border border-slate-700 bg-slate-800/50 pl-10 pr-4 text-sm text-white outline-none transition-all focus:border-blue-500/50 focus:ring-4 focus:ring-blue-500/5"
            />
          </div>

          {/* Notifications */}
          <button
            className="relative flex h-9 w-9 md:h-10 md:w-10 items-center justify-center rounded-xl bg-slate-800 border border-slate-700 hover:border-slate-500 text-slate-400 transition-all"
            title="Notificaciones"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
            <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-slate-800"></span>
          </button>

          {/* User profile */}
          <div className="flex items-center gap-2 md:gap-3 pl-2 border-l border-slate-700">
            <div className="text-right hidden lg:block">
              <p className="text-xs font-bold text-white truncate max-w-[120px]">{userName}</p>
              <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">{userRole}</p>
            </div>
            <div className="w-9 h-9 md:w-10 md:h-10 rounded-xl bg-gradient-to-br from-slate-700 to-slate-800 border border-slate-600 flex items-center justify-center overflow-hidden shrink-0">
               <div className="w-full h-full bg-slate-400/20 flex items-center justify-center text-[10px] md:text-xs font-bold text-white uppercase">
                 {initials}
               </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}
