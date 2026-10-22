import type { Metadata } from "next";
import { ButtonLink, EmptyState } from "@nexo/ui";

export const metadata: Metadata = {
  title: "Sin acceso · Nexo",
};

/**
 * Página de acceso denegado — mismo patrón que los módulos ("sin-acceso"
 * FUERA del grupo (app) para evitar bucles de redirección).
 *
 * IMPORTANTE: lanzar PermissionDeniedError NO renderiza esta página por sí
 * solo. Es el guard de servidor de la ruta protegida el que debe redirigir
 * aquí explícitamente. El ticket #18 mueve Agencia a su propia zona,
 * cuya pantalla de denegación vive en apps/agencia/src/app/sin-acceso.
 * Esta página queda disponible para los recursos propios de Nexo.
 *
 * Nunca muestra un código de permiso (EmptyState variant="no-access").
 */
export default function SinAccesoPage() {
  return (
    <main className="mx-auto flex min-h-full w-full max-w-2xl flex-col justify-center px-4 py-16 sm:px-6">
      <h1 className="sr-only">Sin acceso</h1>
      <EmptyState
        variant="no-access"
        title="No tienes acceso a esta sección"
        action={<ButtonLink href="/">Volver al inicio</ButtonLink>}
      />
    </main>
  );
}
