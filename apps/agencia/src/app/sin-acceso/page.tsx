import type { Metadata } from "next";
import { BackToPanelLink, Button, EmptyState } from "@nexo/ui";
import { getPanelUrl, getPlatformSettings, signOut } from "@nexo/auth";

export const metadata: Metadata = {
  title: "Sin acceso · Agencia digital",
};

/**
 * Sesión válida sin acceso al módulo para la empresa actual (ver el guard en
 * app/(app)/layout.tsx). Vive fuera del route group (app) a propósito: si
 * estuviera adentro, el mismo guard que redirige para acá volvería a
 * redirigir, en loop infinito. El logo (BackToPanelLink) vuelve al Launcher:
 * el texto "Volver a Nexo" quedó eliminado en toda la suite (2026-09-14).
 * Nunca muestra el código del permiso: dice a quién pedirlo.
 */
export default async function SinAccesoPage() {
  const [panelUrl, { logoUrl }] = await Promise.all([getPanelUrl(), getPlatformSettings()]);

  return (
    <main className="flex min-h-full flex-1 items-center justify-center bg-neutral-100 px-4 py-16">
      <div className="flex w-full max-w-md flex-col items-center gap-6">
        <BackToPanelLink href={panelUrl} logoUrl={logoUrl} />
        <h1 className="sr-only">Sin acceso a Agencia digital</h1>
        <EmptyState
          variant="no-access"
          className="w-full"
          title="No tienes acceso a Agencia digital"
          description="Tu rol no incluye esta aplicación. Si crees que es un error, pide a quien administra Nexo en tu empresa que la agregue a tu rol."
          action={
            <form action={signOut}>
              <Button type="submit" variant="secondary">
                Cerrar sesión
              </Button>
            </form>
          }
        />
      </div>
    </main>
  );
}
