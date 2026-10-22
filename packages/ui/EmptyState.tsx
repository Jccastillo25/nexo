// Estado vacio universal — reemplaza los "todavia no hay X"/"pendiente de Y"
// que cada pantalla escribia con su propio <p> suelto. Se usa tanto para
// "sin datos" como para "funcionalidad pendiente" (ej. pestañas de perfil
// de empleado que requieren un modelo de datos aun no aprobado — ver
// docs/RRHH_MVP.md §14). Regla obligatoria (CLAUDE.md): nunca inventar un
// numero/dato aca, este componente es justamente la alternativa explicita a
// eso.
//
// v2 (2026-10-20): variantes con icono propio en un circulo de 40px —
//   empty       todavia no hay nada (invita a crear el primero)
//   no-results  hay datos, pero no para estos filtros
//   no-access   sin permiso — escudo, y NUNCA el codigo de permiso: di a
//               quien pedir acceso, no "rrhh.expedientes.empleado.ver"
//   error       fallo la consulta (role="alert"); sin el mensaje tecnico
//   pending     funcion o fuente de datos todavia no integrada
//   dropzone    zona para soltar un archivo (unica con borde punteado)
// Acciones principal y secundaria opcionales. `bare` quita la tarjeta para
// usarlo dentro de otra (tabla, FormSection). La API anterior (title,
// description, icon, action) sigue igual.
// Sin "use client": usable desde Server Components.
import type { ReactNode } from "react";
import { NexoIcon, type NexoIconName } from "./nexo-icons";

export type EmptyStateVariant = "empty" | "no-results" | "no-access" | "error" | "pending" | "dropzone";

export interface EmptyStateProps {
  title: string;
  description?: ReactNode;
  /** Reemplaza el icono de la variante. */
  icon?: ReactNode;
  /** Accion principal (p. ej. <ButtonLink href="/nuevo">Crear producto</ButtonLink>). */
  action?: ReactNode;
  secondaryAction?: ReactNode;
  variant?: EmptyStateVariant;
  /** Sin tarjeta propia: para usarlo dentro de una tabla o seccion. */
  bare?: boolean;
  className?: string;
}

const VARIANT_ICON: Record<EmptyStateVariant, NexoIconName> = {
  empty: "inbox",
  "no-results": "search",
  "no-access": "shield",
  error: "alert-circle",
  pending: "clock",
  dropzone: "upload",
};

// Texto por defecto solo para las variantes nuevas: un EmptyState sin
// `variant` (todos los usos anteriores) no cambia de contenido.
const DEFAULT_DESCRIPTION: Partial<Record<EmptyStateVariant, string>> = {
  "no-results": "Prueba con otros filtros o borra la búsqueda.",
  "no-access": "Si necesitas entrar aquí, pide acceso a quien administra Nexo en tu empresa.",
  error: "Intenta de nuevo en unos minutos. Si el problema sigue, avisa a soporte.",
  pending: "Pendiente de integración.",
};

export function EmptyState({
  title,
  description,
  icon,
  action,
  secondaryAction,
  variant = "empty",
  bare = false,
  className,
}: EmptyStateProps) {
  const text = description ?? DEFAULT_DESCRIPTION[variant];
  const container =
    variant === "dropzone"
      ? "rounded-xl border-2 border-dashed border-neutral-300 bg-neutral-50"
      : bare
        ? ""
        : "rounded-xl border border-neutral-200 bg-white shadow-xs";
  const circle = variant === "error" ? "bg-red-50 text-red-600" : "bg-neutral-100 text-neutral-500";

  return (
    <div
      role={variant === "error" ? "alert" : undefined}
      className={`flex flex-col items-center px-6 py-10 text-center ${container} ${className ?? ""}`}
    >
      <span
        aria-hidden="true"
        className={`flex size-10 shrink-0 items-center justify-center rounded-full [&_svg]:size-5 ${circle}`}
      >
        {icon ?? <NexoIcon name={VARIANT_ICON[variant]} />}
      </span>
      <p className="mt-3 text-[15px] leading-6 font-semibold text-neutral-900">{title}</p>
      {text ? <div className="mt-1 max-w-md text-sm text-neutral-500">{text}</div> : null}
      {action || secondaryAction ? (
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          {action}
          {secondaryAction}
        </div>
      ) : null}
    </div>
  );
}
