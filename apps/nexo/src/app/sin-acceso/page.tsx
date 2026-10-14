import type { Metadata } from "next";
import { EmptyState, PageHeader } from "@nexo/ui";
import { NEXO_NAV_ITEMS } from "@/lib/nav";

export const metadata: Metadata = {
  title: "Sin acceso · Nexo",
};

/**
 * Página de acceso denegado — mismo patrón que apps/crm y apps/rrhh
 * ("sin-acceso" FUERA del grupo (app) para evitar bucles de redirección).
 *
 * IMPORTANTE: lanzar PermissionDeniedError NO renderiza esta página por sí
 * solo. Es el guard de servidor de la ruta protegida el que debe redirigir
 * aquí explícitamente. El ticket #18 mueve Agencia a su propia zona,
 * cuya pantalla de denegación vive en apps/agencia/src/app/sin-acceso.
 * Esta página queda disponible para los recursos propios de Nexo.
 */
export default function SinAccesoPage() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-10 sm:px-6">
      <PageHeader
        title="Sin acceso"
        description="Tu cuenta no tiene permisos para ver este recurso. Si creés que es un error, pedile a un owner/admin que revise tus permisos."
      />
      <EmptyState
        title="Acceso denegado"
        description="No podés ver esta sección con los permisos actuales de tu cuenta. Podés volver al inicio del panel para continuar."
      />
      <ul className="flex flex-col gap-2">
        {NEXO_NAV_ITEMS.map((item) => (
          <li key={item.href}>
            <a
              href={item.href}
              className="text-sm font-medium text-neutral-800 underline underline-offset-2 hover:text-neutral-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900"
            >
              {item.label}
            </a>
          </li>
        ))}
      </ul>
    </main>
  );
}
