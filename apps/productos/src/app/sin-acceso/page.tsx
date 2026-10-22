import type { Metadata } from "next";
import { BackToPanelLink, Button, EmptyState } from "@nexo/ui";
import { getPanelUrl, getPlatformSettings, signOut } from "@nexo/auth";

export const metadata: Metadata = {
  title: "Sin acceso · Productos",
};

/**
 * Sesión válida sin acceso al módulo. Fuera de (app) para no entrar en loop
 * con su guard. Nunca muestra el código del permiso: dice a quién pedirlo.
 */
export default async function SinAccesoPage() {
  const [panelUrl, { logoUrl }] = await Promise.all([getPanelUrl(), getPlatformSettings()]);

  return (
    <main className="flex min-h-full flex-1 items-center justify-center bg-neutral-100 px-4 py-16">
      <div className="flex w-full max-w-md flex-col items-center gap-6">
        <BackToPanelLink href={panelUrl} logoUrl={logoUrl} />
        <h1 className="sr-only">Sin acceso a Productos</h1>
        <EmptyState
          variant="no-access"
          className="w-full"
          title="No tienes acceso a Productos"
          description="Tu rol no incluye esta aplicación. Pide a quien administra Nexo en tu empresa que la agregue a tu rol en Configuración → Roles."
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
