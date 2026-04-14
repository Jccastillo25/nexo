'use client'

import { usePathname } from 'next/navigation'
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
  companies?: { id: string; name: string; slug: string }[]
}

// Mapa de prefijos de ruta → título de página
// Se evalúa en orden: el primero que coincide gana.
const ROUTE_PREFIX_MAP: [prefix: string, title: string][] = [
  ['/employees/', 'Colaboradores'],
  ['/organization/', 'Organización'],
  ['/attendance/', 'Marcaciones'],
  ['/schedules/', 'Horarios'],
  ['/reports/', 'Reportes'],
  ['/kiosk/', 'Kioskos'],
  ['/leave/', 'Permisos y Ausencias'],
  ['/settings/', 'Configuración'],
  ['/security/', 'Seguridad'],
  ['/contracts/', 'Contrataciones'],
  ['/monitor', 'Monitor Operativo'],
]

function getDynamicTitle(pathname: string): string {
  // 1. Coincidencia exacta con los items del nav
  for (const section of adminNav) {
    for (const item of section.items) {
      if (pathname === item.href.split('?')[0]) return item.label
    }
  }

  // 2. Sub-rutas de empleados con contexto adicional
  if (pathname.startsWith('/employees/')) {
    if (pathname.includes('/edit')) return 'Editar Colaborador'
    if (pathname.includes('/new'))  return 'Nuevo Colaborador'
    return 'Perfil de Colaborador'
  }

  // 3. Prefijos genéricos
  for (const [prefix, title] of ROUTE_PREFIX_MAP) {
    if (pathname.startsWith(prefix)) return title
  }

  return 'Panel de Control'
}

export function AdminTopbar({
  sidebarOpen,
  onToggleSidebar,
  onMobileMenuOpen,
  userName = 'Admin',
  userRole = 'Administrador',
  companyName = 'Gestor360',
  companies = [],
}: AdminTopbarProps) {
  const pathname = usePathname()
  const { companyId, setCompanyId } = useGlobalContext()

  const pageTitle   = getDynamicTitle(pathname)
  const isDashboard = pathname === '/dashboard'

  const initials = userName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0])
    .join('')
    .toUpperCase()

  return (
    <header
      className="print:hidden sticky top-0 z-20 border-b h-14"
      style={{
        background:     'var(--topbar-bg)',
        backdropFilter: 'blur(16px)',
        borderColor:    'var(--border-soft)',
      }}
    >
      <div className="flex h-full items-center gap-2 px-3 md:gap-4 md:px-6 overflow-hidden">

        {/* ── Izquierda: hamburger + título ── */}
        <div className="flex items-center gap-2 md:gap-3 min-w-0">

          {/* Hamburger desktop */}
          <button
            onClick={onToggleSidebar}
            className="hidden lg:flex h-9 w-9 items-center justify-center rounded-lg transition-colors shrink-0"
            style={{ color: 'var(--text-muted)' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-elevated)'; e.currentTarget.style.color = 'var(--text-strong)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)' }}
            title={sidebarOpen ? 'Ocultar menú' : 'Mostrar menú'}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>

          {/* Hamburger mobile */}
          <button
            onClick={onMobileMenuOpen}
            className="flex lg:hidden h-9 w-9 items-center justify-center rounded-lg transition-colors shrink-0"
            style={{ color: 'var(--text-muted)' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-elevated)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>

          {/* Título + selector de empresa */}
          <div className="flex flex-col justify-center min-w-0">
            {/* Empresa actual */}
            <div className="flex items-center gap-1.5 mb-0.5">
              <span className="hidden sm:block" style={{ fontSize: '0.55rem', fontWeight: 900, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--text-light)', opacity: 0.7 }}>
                Empresa:
              </span>

              {companies.length > 1 ? (
                <div className="relative flex items-center">
                  <select
                    value={companyId || ''}
                    onChange={e => setCompanyId(e.target.value)}
                    className="appearance-none rounded-md px-2 py-0.5 pr-5 text-[9px] font-black uppercase tracking-widest outline-none cursor-pointer transition-all"
                    style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-soft)', color: 'var(--primary)' }}
                  >
                    <option value="all">Todas</option>
                    {companies.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                  <svg
                    className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2"
                    width="7" height="7" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"
                    style={{ color: 'var(--primary)' }}
                  >
                    <path d="m6 9 6 6 6-6" />
                  </svg>
                </div>
              ) : (
                <span
                  className="text-[9px] font-black uppercase tracking-widest rounded-md px-2 py-0.5 border"
                  style={{ background: 'var(--primary-softer)', color: 'var(--primary)', borderColor: 'var(--primary-soft)' }}
                >
                  {companyName}
                </span>
              )}
            </div>

            {/* Título de página */}
            <div className="flex items-center gap-2 truncate">
              <h1
                className="text-sm md:text-lg font-black tracking-tight leading-none shrink-0"
                style={{ color: 'var(--text-strong)' }}
              >
                {pageTitle}
              </h1>
              {isDashboard && (
                <span
                  className="shrink-0 px-1.5 py-0.5 text-[8px] font-black rounded uppercase border hidden sm:inline"
                  style={{ background: 'var(--primary-softer)', color: 'var(--primary)', borderColor: 'var(--primary-soft)' }}
                >
                  ADMIN
                </span>
              )}
            </div>
          </div>
        </div>

        {/* ── Espaciador ── */}
        <div className="flex-1" />

        {/* ── Derecha: búsqueda + notificaciones + perfil ── */}
        <div className="flex items-center gap-2 md:gap-3 shrink-0">

          {/* Búsqueda (solo xl+) */}
          <div className="relative hidden xl:block">
            <svg
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4"
              style={{ color: 'var(--text-light)' }}
              viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            >
              <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
            </svg>
            <input
              type="text"
              placeholder="Buscar..."
              className="input-dark h-9 w-40 pl-10 pr-4 text-sm rounded-xl"
            />
          </div>

          {/* Notificaciones */}
          <button
            className="relative flex h-9 w-9 items-center justify-center rounded-xl border transition-all"
            style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-soft)', color: 'var(--text-muted)' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-medium)'; e.currentTarget.style.color = 'var(--text-strong)' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-soft)'; e.currentTarget.style.color = 'var(--text-muted)' }}
            title="Notificaciones"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
            <span
              className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full border-2"
              style={{ background: 'var(--danger)', borderColor: 'var(--bg-app)' }}
            />
          </button>

          {/* Perfil */}
          <div
            className="flex items-center gap-2 pl-3 border-l"
            style={{ borderColor: 'var(--border-soft)' }}
          >
            <div className="text-right hidden lg:block">
              <p className="text-xs font-bold truncate max-w-[110px]" style={{ color: 'var(--text-strong)' }}>
                {userName}
              </p>
              <p className="text-[10px] font-medium uppercase tracking-wider" style={{ color: 'var(--text-light)' }}>
                {userRole}
              </p>
            </div>
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border"
              style={{ background: 'var(--primary)', borderColor: 'var(--primary-hover)' }}
            >
              <span className="text-[11px] font-black text-white">{initials}</span>
            </div>
          </div>
        </div>

      </div>
    </header>
  )
}
