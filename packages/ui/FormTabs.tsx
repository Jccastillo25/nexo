"use client";

// Pestañas de formulario/detalle (ej. perfil de empleado: Datos
// personales/Dirección/Información complementaria/...). Controlado por el
// padre (no gestiona su propio "activo" mas alla del estado inicial) para
// que una pagina pueda sincronizar la pestaña activa con un query param si
// lo necesita mas adelante; sin eso, alcanza con el estado interno.
//
// Fix (2026-09-08, bug real en produccion — ver docs/IMPLEMENTATION_STATUS.md):
// la version anterior recibia `children: (activeKey) => ReactNode` — una
// funcion. Como FormTabs es "use client" y se monta desde un Server
// Component (expedientes/[id]/page.tsx), pasar una funcion como prop cruza
// el limite Server→Client y React la rechaza en runtime ("Functions cannot
// be passed directly to Client Components..."), tumbando TODA la pagina.
// El esquema correcto: el padre ya renderiza cada contenido de pestaña como
// JSX (serializable, a diferencia de una funcion) y se lo pasa a cada tab
// via `content` — FormTabs solo decide cual mostrar segun el estado local.
import { useState } from "react";

export interface FormTab {
  key: string;
  label: string;
  /** Deshabilita la pestaña (ej. requiere un modelo de datos que aun no
   * existe) sin ocultarla del todo — asi la navegacion queda "lista" sin
   * inventar contenido, ver docs/RRHH_MVP.md §14. */
  disabled?: boolean;
  /** Contenido ya renderizado de la pestaña (JSX, no una funcion) — se
   * puede construir en un Server Component sin romper la frontera RSC. */
  content: React.ReactNode;
}

export interface FormTabsProps {
  tabs: FormTab[];
  defaultTab?: string;
}

export function FormTabs({ tabs, defaultTab }: FormTabsProps) {
  const [active, setActive] = useState(defaultTab ?? tabs[0]?.key);
  const activeTab = tabs.find((tab) => tab.key === active) ?? tabs[0];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-1 border-b border-neutral-200">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            disabled={tab.disabled}
            onClick={() => setActive(tab.key)}
            className={`relative -mb-px px-3 py-2 text-sm font-medium transition-colors ${
              tab.disabled
                ? "cursor-not-allowed text-neutral-300"
                : active === tab.key
                  ? "border-b-2 border-blue-600 text-blue-600"
                  : "border-b-2 border-transparent text-neutral-500 hover:text-neutral-900"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {activeTab?.content}
    </div>
  );
}
