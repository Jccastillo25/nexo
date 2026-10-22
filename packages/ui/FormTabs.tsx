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
//
// v2 (2026-10-20): delega en Tabs, asi hereda el patron WAI-ARIA completo
// (role="tablist"/"tab"/"tabpanel", aria-selected, flechas de teclado). La
// API (tabs, defaultTab) no cambia.
import { Tabs } from "./Tabs";

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
  /** Nombre accesible de la lista de pestañas. */
  label?: string;
}

export function FormTabs({ tabs, defaultTab, label }: FormTabsProps) {
  return (
    <Tabs
      label={label}
      defaultValue={defaultTab}
      items={tabs.map((tab) => ({ key: tab.key, label: tab.label, disabled: tab.disabled, content: tab.content }))}
    />
  );
}
