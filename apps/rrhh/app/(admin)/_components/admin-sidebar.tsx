'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut } from '../../actions/auth'
import { adminNav } from './admin-nav'
import { useGlobalContext } from '@/context/GlobalContext'

interface AdminSidebarProps {
  companyName?: string
  userName?: string
  userRole?: string
  logoUrl?: string | null
  collapsed?: boolean
  onClose?: () => void
  onExpand?: () => void
  userPermissions?: Record<string, boolean>
  /** Conteo de empleados ausentes/offline — muestra badge en el ítem Monitor */
  monitorAlertCount?: number
}

const roleLabels: Record<string, string> = {
  owner:      'Propietario',
  admin:      'Administrador',
  rrhh:       'RRHH',
  supervisor: 'Supervisor',
  viewer:     'Visor',
}

// ── Iconos ────────────────────────────────────────────────────────────────────

const sectionIcons: Record<string, React.ReactNode> = {
  'Centro de Control': (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
  ),
  'Gestión de Talento': (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
  'Gestión de Turnos': (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
    </svg>
  ),
  'Nómina y Cierres': (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="1" x2="12" y2="23" />
      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </svg>
  ),
  'Configuración': (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  ),
}

const chevronIcon = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="6 9 12 15 18 9" />
  </svg>
)

const kioscoIcon = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="3" width="20" height="14" rx="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" />
  </svg>
)

// ── Helpers ───────────────────────────────────────────────────────────────────

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`)
}

function isSectionActive(pathname: string, items: { href: string }[]) {
  return items.some(item => isActive(pathname, item.href))
}

function hasPermission(permissions: Record<string, boolean>, perm?: string): boolean {
  if (!perm) return true
  return permissions[perm] === true
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0])
    .join('')
    .toUpperCase() || '?'
}

// ── Badge de alerta ───────────────────────────────────────────────────────────

function AlertBadge({ count }: { count: number }) {
  if (count <= 0) return null
  return (
    <span
      className="ml-auto flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[9px] font-black tabular-nums"
      style={{ background: 'var(--danger)', color: '#fff', boxShadow: '0 0 6px var(--danger-glow)' }}
    >
      {count > 99 ? '99+' : count}
    </span>
  )
}

// ── Componente principal ──────────────────────────────────────────────────────

export function AdminSidebar({
  companyName = 'Gestor360',
  userName = 'Administrador',
  userRole = 'admin',
  logoUrl,
  collapsed = false,
  onClose,
  onExpand,
  userPermissions = {},
  monitorAlertCount = 0,
}: AdminSidebarProps) {
  const pathname = usePathname()
  const { companyId } = useGlobalContext()

  const [openSections, setOpenSections] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {}
    adminNav.forEach(section => {
      if (!section.direct && isSectionActive(pathname, section.items)) {
        initial[section.title] = true
      }
    })
    return initial
  })

  const toggleSection = (title: string) => {
    if (collapsed && onExpand) {
      onExpand()
      setOpenSections(prev => ({ ...prev, [title]: true }))
      return
    }
    setOpenSections(prev => ({ ...prev, [title]: !prev[title] }))
  }

  const getHref = (href: string) => {
    if (!companyId || companyId === 'all') return href
    return href.includes('?') ? `${href}&company_id=${companyId}` : `${href}?company_id=${companyId}`
  }

  const initials = getInitials(userName)

  return (
    <aside
      className="print:hidden flex h-full flex-col border-r"
      style={{
        background:     'rgba(30, 41, 59, 0.96)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderColor:    'var(--border-soft)',
      }}
    >
      {/* ── Logo / empresa ── */}
      <div
        className={`flex items-center gap-3 px-4 py-4 border-b ${collapsed ? 'justify-center' : ''}`}
        style={{ borderColor: 'var(--border-soft)' }}
      >
        {logoUrl ? (
          <img
            src={logoUrl}
            alt="Logo"
            className="h-9 w-9 shrink-0 rounded-xl object-contain cursor-pointer"
            onClick={() => collapsed && onExpand?.()}
            title={collapsed ? companyName : undefined}
          />
        ) : (
          <div
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl cursor-pointer"
            style={{ background: 'var(--primary)' }}
            onClick={() => collapsed && onExpand?.()}
            title={collapsed ? companyName : undefined}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
            </svg>
          </div>
        )}

        {!collapsed && (
          <div className="min-w-0 flex-1">
            <p className="truncate text-[14px] font-bold leading-tight" style={{ color: 'var(--text-strong)' }}>
              {companyName}
            </p>
            <p className="text-[10px]" style={{ color: 'var(--text-light)' }}>
              Sistema de Gestión
            </p>
          </div>
        )}

        {onClose && (
          <button
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-lg transition lg:hidden"
            style={{ color: 'var(--text-muted)' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-elevated)'; e.currentTarget.style.color = 'var(--text-strong)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)' }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        )}
      </div>

      {/* ── Navegación ── */}
      <nav aria-label="Navegación principal" className={`flex-1 overflow-y-auto py-3 px-2 ${collapsed ? 'overflow-x-hidden' : ''}`}>
        <div className="space-y-0.5">
          {adminNav.map(section => {
            const visibleItems = section.items.filter(item => hasPermission(userPermissions, item.permission))
            if (visibleItems.length === 0) return null
            if (section.permission && !hasPermission(userPermissions, section.permission)) return null

            const sectionActive = isSectionActive(pathname, visibleItems)
            const isOpen        = collapsed ? false : (openSections[section.title] ?? false)
            const icon          = sectionIcons[section.title] ?? sectionIcons['Configuración']

            // Enlace directo (sin hijos)
            if (section.direct) {
              const item   = visibleItems[0]
              if (!item) return null
              const active = isActive(pathname, item.href)

              return (
                <NavItem
                  key={section.title}
                  href={getHref(item.href)}
                  label={item.label}
                  icon={icon}
                  active={active}
                  collapsed={collapsed}
                  onClick={onClose}
                  badge={item.href === '/monitor' ? monitorAlertCount : 0}
                />
              )
            }

            // Sección colapsable
            return (
              <div key={section.title}>
                {/* Cabecera de sección */}
                <button
                  onClick={() => toggleSection(section.title)}
                  aria-expanded={isOpen}
                  aria-controls={`nav-section-${section.title.replace(/\s+/g, '-').toLowerCase()}`}
                  className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2 transition-colors ${collapsed ? 'justify-center' : ''}`}
                  style={{ color: 'var(--text-light)' }}
                  onMouseEnter={e => e.currentTarget.style.color = 'var(--text-muted)'}
                  onMouseLeave={e => e.currentTarget.style.color = 'var(--text-light)'}
                  title={collapsed ? section.title : undefined}
                >
                  <span
                    style={{
                      color: sectionActive ? 'var(--sidebar-active-text)' : 'var(--sidebar-icon)',
                      transition: 'color 150ms',
                    }}
                  >
                    {icon}
                  </span>
                  {!collapsed && (
                    <>
                      <span
                        className="flex-1 text-left text-[11px] font-black uppercase tracking-[0.15em]"
                        style={{ color: sectionActive ? 'var(--sidebar-active-text)' : 'var(--text-light)' }}
                      >
                        {section.title}
                      </span>
                      {/* Badge de alerta en sección Monitor */}
                      {sectionActive && section.title === 'Centro de Control' && monitorAlertCount > 0 && (
                        <AlertBadge count={monitorAlertCount} />
                      )}
                      <span
                        className="transition-transform duration-200 shrink-0"
                        style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
                      >
                        {chevronIcon}
                      </span>
                    </>
                  )}
                </button>

                {/* Items hijos */}
                {!collapsed && (
                  <div
                    id={`nav-section-${section.title.replace(/\s+/g, '-').toLowerCase()}`}
                    className="collapse-content"
                    data-open={isOpen}
                  >
                    <div>
                      <div
                        className="ml-7 mt-0.5 space-y-0.5 border-l py-1 pl-3"
                        style={{ borderColor: 'var(--border-soft)' }}
                      >
                        {visibleItems.map(item => {
                          const active = isActive(pathname, item.href)
                          return (
                            <Link
                              key={item.href}
                              href={getHref(item.href)}
                              onClick={onClose}
                              aria-current={active ? 'page' : undefined}
                              className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-[12px] font-medium transition-all"
                              style={{
                                background:  active ? 'var(--sidebar-active-bg)' : 'transparent',
                                color:       active ? 'var(--sidebar-active-text)' : 'var(--text-muted)',
                                borderLeft:  active ? '2px solid var(--primary)' : '2px solid transparent',
                              }}
                              onMouseEnter={e => {
                                if (!active) e.currentTarget.style.background = 'var(--bg-elevated)'
                              }}
                              onMouseLeave={e => {
                                if (!active) e.currentTarget.style.background = 'transparent'
                              }}
                            >
                              <span className="flex-1 truncate">{item.label}</span>
                              {/* Badge en Monitor si está dentro de Centro de Control */}
                              {item.href === '/monitor' && <AlertBadge count={monitorAlertCount} />}
                            </Link>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </nav>

      {/* ── Footer ── */}
      <div
        className="border-t px-2 py-3 space-y-1"
        style={{ borderColor: 'var(--border-soft)' }}
      >
        {/* Ir al Kiosco */}
        <Link
          href="/"
          className={`flex items-center gap-2.5 rounded-xl px-3 py-2 text-[12px] font-medium transition-colors ${collapsed ? 'justify-center' : ''}`}
          style={{ color: 'var(--text-muted)' }}
          onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-elevated)'; e.currentTarget.style.color = 'var(--text-body)' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)' }}
          title={collapsed ? 'Ir al Kiosco' : undefined}
        >
          <span style={{ color: 'var(--sidebar-icon)' }}>{kioscoIcon}</span>
          {!collapsed && 'Ir al Kiosco'}
        </Link>

        {/* Perfil de usuario */}
        {collapsed ? (
          /* Avatar compacto en modo colapsado */
          <button
            className="flex w-full items-center justify-center"
            onClick={() => onExpand?.()}
            title={`${userName} — ${roleLabels[userRole] ?? 'Administrador'}`}
          >
            <div
              className="flex h-9 w-9 items-center justify-center rounded-xl text-sm font-black text-white"
              style={{ background: 'var(--primary)' }}
            >
              {initials}
            </div>
          </button>
        ) : (
          /* Tarjeta de usuario expandida */
          <div
            className="flex items-center gap-3 rounded-xl px-3 py-2.5 border"
            style={{ borderColor: 'var(--border-soft)', background: 'var(--bg-elevated)' }}
          >
            <div
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm font-black text-white"
              style={{ background: 'var(--primary)' }}
            >
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-semibold leading-tight" style={{ color: 'var(--text-strong)' }}>
                {userName}
              </p>
              <p className="text-[10px] font-medium uppercase tracking-wide" style={{ color: 'var(--text-light)' }}>
                {roleLabels[userRole] ?? 'Administrador'}
              </p>
            </div>
            <form action={signOut}>
              <button
                type="submit"
                title="Cerrar sesión"
                className="rounded-lg p-1.5 transition-colors"
                style={{ color: 'var(--text-light)' }}
                onMouseEnter={e => { e.currentTarget.style.color = 'var(--danger)'; e.currentTarget.style.background = 'var(--danger-soft)' }}
                onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-light)'; e.currentTarget.style.background = 'transparent' }}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
                </svg>
              </button>
            </form>
          </div>
        )}
      </div>
    </aside>
  )
}

// ── NavItem helper (para ítems directos) ──────────────────────────────────────

function NavItem({
  href, label, icon, active, collapsed, onClick, badge = 0,
}: {
  href: string
  label: string
  icon: React.ReactNode
  active: boolean
  collapsed: boolean
  onClick?: () => void
  badge?: number
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      className={`flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-[13px] font-medium transition-all ${collapsed ? 'justify-center' : ''}`}
      style={{
        background: active ? 'var(--sidebar-active-bg)' : 'transparent',
        color:      active ? 'var(--sidebar-active-text)' : 'var(--sidebar-text)',
        borderLeft: active ? '2px solid var(--primary)' : '2px solid transparent',
      }}
      onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'var(--bg-elevated)' }}
      onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent' }}
      title={collapsed ? label : undefined}
    >
      <span style={{ color: active ? 'var(--sidebar-active-text)' : 'var(--sidebar-icon)' }}>
        {icon}
      </span>
      {!collapsed && (
        <>
          <span className="flex-1">{label}</span>
          <AlertBadge count={badge} />
        </>
      )}
    </Link>
  )
}
