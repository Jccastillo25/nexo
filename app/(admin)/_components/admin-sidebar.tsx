'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut } from '../../actions/auth'
import { adminNav } from './admin-nav'

interface AdminSidebarProps {
  companyName?: string
  userName?: string
  userRole?: string
  logoUrl?: string | null
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

function itemClass(active: boolean) {
  return [
    'flex items-center rounded-2xl px-4 py-3 text-sm font-medium transition',
    active
      ? 'bg-slate-900 text-white shadow-sm'
      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
  ].join(' ')
}

export function AdminSidebar({
  companyName = 'Grupo CT',
  userName = 'Administrador',
  userRole = 'admin',
  logoUrl,
}: AdminSidebarProps) {
  const pathname = usePathname()
  const [searchQuery, setSearchQuery] = useState('')

  const filteredNav = adminNav.map(section => ({
    ...section,
    items: section.items.filter(item => 
      item.label.toLowerCase().includes(searchQuery.toLowerCase())
    )
  })).filter(section => section.items.length > 0)

  return (
    <aside className="border-r border-slate-200 bg-white">
      <div className="flex h-full flex-col">

        {/* Encabezado */}
        <div className="border-b border-slate-200 px-6 py-6">
          {logoUrl ? (
            <img
              src={logoUrl}
              alt="Logo"
              className="mb-3 h-10 w-auto max-w-[160px] object-contain"
            />
          ) : (
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
              Sistema de marcación
            </p>
          )}
          <h1 className="mt-2 text-2xl font-bold text-slate-900">
            Área Administrativa
          </h1>
          <div className="mt-4 rounded-3xl bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
              Empresa activa
            </p>
            <p className="mt-1 text-sm font-semibold text-slate-800">
              {companyName}
            </p>
          </div>
        </div>
        {/* Buscador */}
        <div className="px-4 py-4">
          <div className="relative">
            <input
              type="text"
              placeholder="Buscar módulo..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-4 text-xs font-medium outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
            />
            <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
            </div>
          </div>
        </div>

        {/* Navegación */}
        <div className="flex-1 overflow-y-auto px-4 py-2">
          {filteredNav.map((section) => (
            <div key={section.title} className="mb-6">
              <p className="mb-2 px-2 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">
                {section.title}
              </p>
              <div className="space-y-1">
                {section.items.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={itemClass(isActive(pathname, item.href))}
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer usuario */}
        <div className="border-t border-slate-200 px-4 py-4 space-y-3">
          <Link
            href="/"
            className="flex items-center justify-center rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Ir al kiosko
          </Link>

          <div className="rounded-3xl bg-slate-50 p-4">
            <p className="text-sm font-semibold text-slate-800">{userName}</p>
            <p className="mt-1 text-xs text-slate-500">
              {roleLabels[userRole] ?? 'Administrador'}
            </p>
            <form action={signOut} className="mt-3">
              <button
                type="submit"
                className="text-xs font-medium text-slate-400 underline-offset-2 transition hover:text-slate-600 hover:underline"
              >
                Cerrar sesión
              </button>
            </form>
          </div>
        </div>

      </div>
    </aside>
  )
}
