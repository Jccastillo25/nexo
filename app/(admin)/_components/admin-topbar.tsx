'use client'

interface AdminTopbarProps {
  sidebarOpen: boolean
  onToggleSidebar: () => void
  onMobileMenuOpen: () => void
  userName?: string
}

export function AdminTopbar({
  sidebarOpen,
  onToggleSidebar,
  onMobileMenuOpen,
  userName = 'Admin',
}: AdminTopbarProps) {
  const initials = userName
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase()

  return (
    <header
      className="sticky top-0 z-20 border-b"
      style={{
        background: 'rgba(255,255,255,0.92)',
        backdropFilter: 'blur(12px)',
        borderColor: 'var(--border-soft)',
      }}
    >
      <div className="flex items-center gap-3 px-4 py-2.5 md:px-6">

        {/* ── Left: Hamburger + Search ── */}
        <div className="flex items-center gap-2">
          {/* Desktop toggle */}
          <button
            onClick={onToggleSidebar}
            className="hidden lg:flex h-9 w-9 items-center justify-center rounded-lg transition-colors"
            style={{ color: 'var(--text-muted)' }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--sidebar-item-hover)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            title={sidebarOpen ? 'Ocultar menú' : 'Mostrar menú'}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>

          {/* Mobile toggle */}
          <button
            onClick={onMobileMenuOpen}
            className="flex lg:hidden h-9 w-9 items-center justify-center rounded-lg transition-colors"
            style={{ color: 'var(--text-muted)' }}
            title="Abrir menú"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>

          {/* Search bar */}
          <div className="relative hidden md:block">
            <svg
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2"
              width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              style={{ color: 'var(--text-light)' }}
            >
              <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
            </svg>
            <input
              type="text"
              placeholder="Buscar empleados..."
              className="h-9 w-56 rounded-xl border pl-10 pr-4 text-sm outline-none transition lg:w-72"
              style={{
                borderColor: 'var(--border-soft)',
                background: 'var(--bg-app)',
                color: 'var(--text-body)',
              }}
            />
          </div>
        </div>

        {/* ── Spacer ── */}
        <div className="flex-1" />

        {/* ── Right: Notifications + Avatar ── */}
        <div className="flex items-center gap-2">
          {/* Notification bell */}
          <button
            className="flex h-9 w-9 items-center justify-center rounded-xl border transition-colors"
            style={{
              borderColor: 'var(--border-soft)',
              color: 'var(--text-muted)',
              background: 'white',
            }}
            title="Notificaciones"
            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-app)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'white')}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
          </button>

          {/* User avatar */}
          <div
            className="flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold text-white cursor-default"
            style={{ background: 'var(--primary)' }}
            title={userName}
          >
            {initials}
          </div>
        </div>
      </div>
    </header>
  )
}
