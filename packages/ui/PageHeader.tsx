// Encabezado de pantalla — titulo + descripcion + acciones, con el
// breadcrumb opcional arriba (normalmente ya lo muestra NexoTopbar; este
// slot es para el caso de una pagina con sub-navegacion que el arbol de
// sidebar no modela). Reemplaza los `<h1>` sueltos con clases repetidas
// que tenia cada pagina (ver expedientes/page.tsx, jornadas/page.tsx,
// dashboard/page.tsx antes del rediseño).
//
// v2 (2026-10-20), compatible con la API anterior:
//   - `back`: enlace de regreso dentro del modulo (next/link), arriba del
//     titulo ("Empleados" desde la ficha de un empleado). No es para volver
//     al Launcher: eso lo hace el texto "Nexo" del sidebar;
//   - `meta`: insignias o conteo junto al titulo (<StatusBadge>, "699");
//   - `tabs`: pestañas debajo del encabezado (<TabLinks> o <Tabs>);
//   - `actions` a la derecha; en movil bajan a una fila completa.
// Un solo h1 por pagina: este.
import Link from "next/link";
import type { ReactNode } from "react";
import { Breadcrumb, type BreadcrumbItem } from "./Breadcrumb";
import { NexoIcon } from "./nexo-icons";

export interface PageHeaderProps {
  title: string;
  description?: ReactNode;
  breadcrumb?: BreadcrumbItem[];
  actions?: ReactNode;
  meta?: ReactNode;
  /** Enlace de regreso dentro del modulo. `label` por defecto: "Volver". */
  back?: { href: string; label?: string };
  tabs?: ReactNode;
}

export function PageHeader({ title, description, breadcrumb, actions, meta, back, tabs }: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-4">
      {breadcrumb && breadcrumb.length > 0 && <Breadcrumb items={breadcrumb} />}
      {back ? (
        <Link
          href={back.href}
          className="inline-flex w-fit items-center gap-1.5 rounded-sm text-sm font-medium text-neutral-500 transition-colors hover:text-neutral-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
        >
          <NexoIcon name="arrow-left" className="size-4" />
          {back.label ?? "Volver"}
        </Link>
      ) : null}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">{title}</h1>
            {meta ? <div className="flex flex-wrap items-center gap-2">{meta}</div> : null}
          </div>
          {description ? <p className="mt-1 max-w-2xl text-sm text-neutral-500">{description}</p> : null}
        </div>
        {actions ? (
          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:shrink-0 sm:justify-end">
            {actions}
          </div>
        ) : null}
      </div>
      {tabs ? <div>{tabs}</div> : null}
    </div>
  );
}
