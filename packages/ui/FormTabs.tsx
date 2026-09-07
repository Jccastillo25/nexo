"use client";

// Pestañas de formulario/detalle (ej. perfil de empleado: Datos
// personales/Dirección/Información complementaria/...). Controlado por el
// padre (no gestiona su propio "activo" mas alla del estado inicial) para
// que una pagina pueda sincronizar la pestaña activa con un query param si
// lo necesita mas adelante; sin eso, alcanza con el estado interno.
import { useState } from "react";

export interface FormTab {
  key: string;
  label: string;
  /** Deshabilita la pestaña (ej. requiere un modelo de datos que aun no
   * existe) sin ocultarla del todo — asi la navegacion queda "lista" sin
   * inventar contenido, ver docs/RRHH_MVP.md §14. */
  disabled?: boolean;
}

export interface FormTabsProps {
  tabs: FormTab[];
  defaultTab?: string;
  children: (activeKey: string) => React.ReactNode;
}

export function FormTabs({ tabs, defaultTab, children }: FormTabsProps) {
  const [active, setActive] = useState(defaultTab ?? tabs[0]?.key);

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
      {children(active)}
    </div>
  );
}
