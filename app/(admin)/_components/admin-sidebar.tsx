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
}

const roleLabels: Record<string, string> = {
  owner: 'Propietario',
  admin: 'Administrador',
  rrhh: 'RRHH',
  supervisor: 'Supervisor',
  viewer: 'Visor',
}

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`)
}

function isSectionActive(pathname: string, items: { href: string }[]) {
  return items.some((item) => isActive(pathname, item.href))
}

/* ── Icons map ── */
const sectionIcons: Record<string, React.ReactNode> = {
  Dashboard: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
  ),
  Monitor: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 16V4a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2z" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" />
    </svg>
  ),
  Empleados: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
  Marcaciones: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
    </svg>
  ),
  Horarios: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  ),
  Contrataciones: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><path d="M16 13H8" /><path d="M16 17H8" /><path d="M10 9H8" />
    </svg>
  ),
  Aprobaciones: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 11 12 14 22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
    </svg>
  ),
  Reportes: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" />
    </svg>
  ),
  Organización: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  ),
  Sistema: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  ),
  Kiosko: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="20" height="14" rx="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" />
    </svg>
  ),
}

const chevronIcon = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="6 9 12 15 18 9" />
  </svg>
)

export function AdminSidebar({
  companyName = 'Gestor360',
  userName = 'Administrador',
  userRole = 'admin',
  logoUrl,
  onClose,
}: AdminSidebarProps) {
  const pathname = usePathname()
  const { companyId } = useGlobalContext()

  // Track which sections are expanded — open sections that have an active child by default
  const [openSections, setOpenSections] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {}
    adminNav.forEach((section) => {
      if (!section.direct && isSectionActive(pathname, section.items)) {
        initial[section.title] = true
      }
    })
    return initial
  })

  const toggleSection = (title: string) => {
    setOpenSections((prev) => ({ ...prev, [title]: !prev[title] }))
  }

  const initials = userName
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase()

  const getHref = (href: string) => {
    if (!companyId || companyId === 'all') return href
    return href.includes('?') ? `${href}&company_id=${companyId}` : `${href}?company_id=${companyId}`
  }

  return (
    <aside className="print:hidden flex h-full flex-col transition-colors border-r" style={{ background: 'var(--sidebar-bg)', borderColor: 'var(--border-soft)' }}>

      {/* ── Logo area ── */}
      <div className="flex items-center gap-3 px-5 py-5">
        {logoUrl ? (
          <img src={logoUrl} alt="Logo" className="h-10 w-10 rounded-xl object-contain" />
        ) : (
          <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: 'var(--primary)' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
            </svg>
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-bold" style={{ color: 'var(--text-strong)' }}>{companyName}</p>
          <p className="text-xs" style={{ color: 'var(--text-light)' }}>Sistema de Gestión</p>
        </div>
        {/* Close button for mobile */}
        {onClose && (
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition hover:bg-gray-100 hover:text-gray-600 lg:hidden"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        )}
      </div>

      {/* ── Navigation ── */}
      <nav className="flex-1 overflow-y-auto px-3 py-2">
        <div className="space-y-0.5">
          {adminNav.map((section) => {
            const sectionActive = isSectionActive(pathname, section.items)
            const isOpen = openSections[section.title] ?? false
            const icon = sectionIcons[section.title]

            // Direct link (no children)
            if (section.direct) {
              const item = section.items[0]
              const active = isActive(pathname, item.href)
              return (
                <Link
                  key={section.title}
                  href={getHref(item.href)}
                  onClick={onClose}
                  className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-[14px] font-medium transition-colors"
                  style={{
                    background: active ? 'var(--sidebar-active-bg)' : 'transparent',
                    color: active ? 'var(--sidebar-active-text)' : 'var(--sidebar-text)',
                  }}
                >
                  <span style={{ color: active ? 'var(--sidebar-active-text)' : 'var(--sidebar-icon)' }}>
                    {icon}
                  </span>
                  {item.label}
                </Link>
              )
            }

            // Section with children (collapsible)
            return (
              <div key={section.title}>
                <button
                  onClick={() => toggleSection(section.title)}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[14px] font-medium transition-colors"
                  style={{
                    background: sectionActive && !isOpen ? 'var(--sidebar-active-bg)' : 'transparent',
                    color: sectionActive ? 'var(--sidebar-active-text)' : 'var(--sidebar-text)',
                  }}
                >
                  <span style={{ color: sectionActive ? 'var(--sidebar-active-text)' : 'var(--sidebar-icon)' }}>
                    {icon}
                  </span>
                  <span className="flex-1 text-left">{section.title}</span>
                  <span
                    className="transition-transform duration-200"
                    style={{
                      transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                      color: 'var(--text-light)',
                    }}
                  >
                    {chevronIcon}
                  </span>
                </button>

                {/* Collapsible children */}
                <div className="collapse-content" data-open={isOpen}>
                  <div>
                    <div className="ml-8 space-y-0.5 border-l-2 py-1 pl-3" style={{ borderColor: 'var(--border-medium)' }}>
                      {section.items.map((item) => {
                        const active = isActive(pathname, item.href)
                        return (
                          <Link
                            key={item.href}
                            href={getHref(item.href)}
                            onClick={onClose}
                            className="block rounded-lg px-3 py-2 text-[13px] font-medium transition-colors"
                            style={{
                              background: active ? 'var(--sidebar-active-bg)' : 'transparent',
                              color: active ? 'var(--sidebar-active-text)' : 'var(--text-muted)',
                            }}
                          >
                            {item.label}
                          </Link>
                        )
                      })}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </nav>

      {/* ── Footer ── */}
      <div className="border-t px-3 py-3 space-y-2" style={{ borderColor: 'var(--border-medium)' }}>
        {/* Kiosk link */}
        <Link
          href="/"
          className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors"
          style={{ color: 'var(--sidebar-text)' }}
          onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--sidebar-item-hover)')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--sidebar-icon)' }}>
            <rect x="2" y="3" width="20" height="14" rx="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" />
          </svg>
          Ir al Kiosco
        </Link>

        {/* User info */}
        <div className="flex items-center gap-3 rounded-xl px-3 py-3 border transition-colors" style={{ background: 'transparent', borderColor: 'var(--border-medium)' }}>
          <div
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
            style={{ background: 'var(--primary)' }}
          >
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold" style={{ color: 'var(--text-strong)' }}>{userName}</p>
            <p className="text-xs" style={{ color: 'var(--text-light)' }}>{roleLabels[userRole] ?? 'Administrador'}</p>
          </div>
          <form action={signOut}>
            <button type="submit" title="Cerrar sesión" className="transition" style={{ color: 'var(--text-light)' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
              </svg>
            </button>
          </form>
        </div>
      </div>
    </aside>
  )
}
