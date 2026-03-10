'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { adminNav } from './admin-nav'

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

export function AdminSidebar() {
  const pathname = usePathname()

  return (
    <aside className="border-r border-slate-200 bg-white">
      <div className="flex h-full flex-col">
        <div className="border-b border-slate-200 px-6 py-6">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
            Grupo CT
          </p>

          <h1 className="mt-2 text-2xl font-bold text-slate-900">
            Área Administrativa
          </h1>

          <div className="mt-4 rounded-3xl bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
              Empresa activa
            </p>
            <p className="mt-1 text-sm font-semibold text-slate-800">
              Materiales JCastillo
            </p>
            <p className="mt-2 text-xs text-slate-500">
              Sucursal: SUC 02 — Ferretería La Máxima
            </p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4">
          {adminNav.map((section) => (
            <div key={section.title} className="mb-6">
              <p className="mb-2 px-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                {section.title}
              </p>

              <div className="space-y-2">
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

        <div className="border-t border-slate-200 px-4 py-4">
          <Link
            href="/"
            className="flex items-center justify-center rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Ir al kiosko
          </Link>

          <div className="mt-4 rounded-3xl bg-slate-50 p-4">
            <p className="text-sm font-semibold text-slate-800">Julio Castillo</p>
            <p className="mt-1 text-xs text-slate-500">Administrador</p>
          </div>
        </div>
      </div>
    </aside>
  )
}
