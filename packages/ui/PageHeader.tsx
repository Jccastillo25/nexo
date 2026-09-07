// Encabezado de pantalla — titulo + descripcion + acciones, con el
// breadcrumb opcional arriba (normalmente ya lo muestra NexoTopbar; este
// slot es para el caso de una pagina con sub-navegacion que el arbol de
// sidebar no modela). Reemplaza los `<h1>` sueltos con clases repetidas
// que tenia cada pagina (ver expedientes/page.tsx, jornadas/page.tsx,
// dashboard/page.tsx antes del rediseño).
import { Breadcrumb, type BreadcrumbItem } from "./Breadcrumb";

export interface PageHeaderProps {
  title: string;
  description?: string;
  breadcrumb?: BreadcrumbItem[];
  actions?: React.ReactNode;
}

export function PageHeader({ title, description, breadcrumb, actions }: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-3">
      {breadcrumb && breadcrumb.length > 0 && <Breadcrumb items={breadcrumb} />}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900">{title}</h1>
          {description && <p className="mt-1 text-sm text-neutral-500">{description}</p>}
        </div>
        {actions && <div className="flex flex-shrink-0 items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}
