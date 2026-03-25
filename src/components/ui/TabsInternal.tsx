'use client'

/**
 * TabsInternal Component
 *
 * Componente reutilizable para tabs internos gestionados con estado local.
 * Ideal para formularios, wizards, o vistas donde los tabs no necesitan ser compartibles por URL.
 *
 * Características:
 * - Gestión de estado local con onClick handlers
 * - Transiciones suaves entre pestañas
 * - Estilos consistentes en toda la aplicación
 * - Accesibilidad básica con atributos ARIA
 *
 * @example
 * ```tsx
 * const [activeTab, setActiveTab] = useState('general')
 *
 * <TabsInternal
 *   tabs={[
 *     { id: 'general', label: 'General' },
 *     { id: 'identification', label: 'Identificación' },
 *   ]}
 *   activeTab={activeTab}
 *   onTabChange={setActiveTab}
 * />
 * ```
 */

interface Tab {
  id: string
  label: string
}

interface TabsInternalProps {
  tabs: Tab[]
  activeTab: string
  onTabChange: (tabId: string) => void
  className?: string
  variant?: 'default' | 'light' | 'dark'
}

/**
 * Función auxiliar para generar clases de tab basadas en estado activo
 * Garantiza consistencia visual en toda la aplicación
 */
function getTabClass(isActive: boolean, variant: 'default' | 'light' | 'dark' = 'default'): string {
  const baseClass = 'px-5 py-3 text-sm font-semibold transition-all border-b-2 whitespace-nowrap cursor-pointer hover:transition-colors'

  const variantClasses = {
    default: isActive
      ? 'border-slate-900 text-slate-900'
      : 'border-transparent text-slate-500 hover:text-slate-700',
    light: isActive
      ? 'border-slate-800 text-slate-800'
      : 'border-transparent text-slate-400 hover:text-slate-600',
    dark: isActive
      ? 'border-white text-white'
      : 'border-transparent text-slate-400 hover:text-slate-300 hover:border-slate-500',
  }

  return `${baseClass} ${variantClasses[variant]}`
}

export function TabsInternal({
  tabs,
  activeTab,
  onTabChange,
  className = '',
  variant = 'default',
}: TabsInternalProps) {
  if (!tabs || tabs.length === 0) {
    console.warn('TabsInternal: No tabs provided')
    return null
  }

  return (
    <div
      className={`flex overflow-x-auto border-b border-slate-100 -mx-6 px-6 ${className}`}
      role="tablist"
    >
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          className={getTabClass(tab.id === activeTab, variant)}
          role="tab"
          aria-selected={tab.id === activeTab}
          aria-controls={`${tab.id}-panel`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}

export default TabsInternal
