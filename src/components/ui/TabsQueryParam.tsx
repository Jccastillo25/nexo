'use client'

/**
 * TabsQueryParam Component
 *
 * Componente reutilizable para tabs gestionados a través de query parameters en la URL.
 * Ideal para vistas de detalle, dashboards, o cualquier lugar donde quieras que los tabs
 * sean compartibles por URL y persistibles al recargar la página.
 *
 * Características:
 * - URLs compartibles (`/path?tab=id`)
 * - Persistencia al recargar la página
 * - URLs limpias y SEO-friendly
 * - Historial del navegador integrado
 * - Estilos consistentes en toda la aplicación
 *
 * @example
 * ```tsx
 * <TabsQueryParam
 *   tabs={[
 *     { id: 'resumen', label: 'Resumen' },
 *     { id: 'contrato', label: 'Contrato' },
 *   ]}
 *   activeTab={tab}
 *   basePath={`/employees/${employee.id}`}
 * />
 * ```
 */

import Link from 'next/link'

interface Tab {
  id: string
  label: string
}

interface TabsQueryParamProps {
  tabs: Tab[]
  activeTab: string
  basePath: string
  className?: string
  variant?: 'default' | 'light' | 'dark'
  paramName?: string // Nombre del query parameter (default: 'tab')
}

/**
 * Función auxiliar para generar clases de tab basadas en estado activo
 * Garantiza consistencia visual en toda la aplicación
 * Nota: Esta es la misma función que en TabsInternal para mantener
 * consistencia visual entre ambos patrones de navegación
 */
function getTabClass(isActive: boolean, variant: 'default' | 'light' | 'dark' = 'default'): string {
  const baseClass = 'px-5 py-3 text-sm font-semibold transition-all border-b-2 whitespace-nowrap hover:transition-colors'

  const variantClasses = {
    default: isActive
      ? 'border-[var(--primary)] text-white'
      : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-body)] hover:border-[var(--border-medium)]',
    light: isActive
      ? 'border-[var(--primary)] text-white'
      : 'border-transparent text-[var(--text-light)] hover:text-[var(--text-muted)]',
    dark: isActive
      ? 'border-white text-white'
      : 'border-transparent text-slate-400 hover:text-slate-300 hover:border-slate-500',
  }

  return `${baseClass} ${variantClasses[variant]}`
}

export function TabsQueryParam({
  tabs,
  activeTab,
  basePath,
  className = '',
  variant = 'default',
  paramName = 'tab',
}: TabsQueryParamProps) {
  if (!tabs || tabs.length === 0) {
    console.warn('TabsQueryParam: No tabs provided')
    return null
  }

  return (
    <div
      className={`flex overflow-x-auto border-b border-[var(--border-soft)] -mx-6 px-6 ${className}`}
      role="tablist"
    >
      {tabs.map((tab) => (
        <Link
          key={tab.id}
          href={`${basePath}?${paramName}=${tab.id}`}
          className={getTabClass(tab.id === activeTab, variant)}
          role="tab"
          aria-selected={tab.id === activeTab}
          aria-controls={`${tab.id}-panel`}
        >
          {tab.label}
        </Link>
      ))}
    </div>
  )
}

export default TabsQueryParam
