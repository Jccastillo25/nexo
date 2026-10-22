// Aviso en linea (Nexo Enterprise UI v2, 2026-10-20) — reemplaza los
// <div className="rounded-md bg-red-50 ..."> y los <Aviso> locales de cada
// pantalla. Cuatro tonos con icono, titulo, cuerpo y una accion opcional.
// role="alert" solo en `error` (se anuncia de inmediato); el resto usa
// role="status" (se anuncia sin interrumpir).
//
//   <Alert tone="warning" title="Faltan datos del contrato" action={<ButtonLink href="..." size="sm" variant="secondary">Completar</ButtonLink>}>
//     Sin jornada asignada no se pueden registrar marcas.
//   </Alert>
//
// Nunca pongas el mensaje tecnico de un error (texto de Postgres/PostgREST,
// codigos de permiso): di que paso y que puede hacer la persona.
// Sin "use client": usable desde Server Components.
import type { ReactNode } from "react";
import { NexoIcon, type NexoIconName } from "./nexo-icons";

export type AlertTone = "info" | "warning" | "error" | "success";

export interface AlertProps {
  tone?: AlertTone;
  title?: ReactNode;
  children?: ReactNode;
  /** Boton o enlace (p. ej. <Button size="sm" variant="secondary">). */
  action?: ReactNode;
  /** Reemplaza el icono del tono. */
  icon?: ReactNode;
  className?: string;
}

const TONES: Record<AlertTone, { box: string; icon: string; body: string; iconName: NexoIconName }> = {
  info: {
    box: "border-blue-200 bg-blue-50 text-blue-900",
    icon: "text-blue-600",
    body: "text-blue-800",
    iconName: "info",
  },
  warning: {
    box: "border-amber-200 bg-amber-50 text-amber-900",
    icon: "text-amber-600",
    body: "text-amber-800",
    iconName: "alert",
  },
  error: {
    box: "border-red-200 bg-red-50 text-red-900",
    icon: "text-red-600",
    body: "text-red-800",
    iconName: "alert-circle",
  },
  success: {
    box: "border-emerald-200 bg-emerald-50 text-emerald-900",
    icon: "text-emerald-600",
    body: "text-emerald-800",
    iconName: "check-circle",
  },
};

export function Alert({ tone = "info", title, children, action, icon, className }: AlertProps) {
  const t = TONES[tone];
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={`flex gap-3 rounded-lg border px-4 py-3 text-sm ${t.box} ${className ?? ""}`}
    >
      <span className={`mt-0.5 shrink-0 ${t.icon}`} aria-hidden="true">
        {icon ?? <NexoIcon name={t.iconName} className="size-5" />}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          {title ? <p className="font-semibold">{title}</p> : null}
          {children ? <div className={`${title ? "mt-0.5" : ""} ${t.body}`}>{children}</div> : null}
        </div>
        {action ? <div className="flex shrink-0 items-center gap-2">{action}</div> : null}
      </div>
    </div>
  );
}
