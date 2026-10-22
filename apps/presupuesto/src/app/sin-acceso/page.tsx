import type { Metadata } from "next";
import { BackToPanelLink, Button, EmptyState } from "@nexo/ui";
import { getPanelUrl, getPlatformSettings, signOut } from "@nexo/auth";

export const metadata: Metadata = {
  title: "Sin acceso · Presupuesto",
};

/**
 * Se muestra cuando hay sesión válida pero sin `presupuesto.ver_modulo` para
 * la empresa actual (ver el guard en app/(app)/layout.tsx). Vive fuera del
 * route group (app) a propósito: adentro, el mismo guard que redirige aquí
 * volvería a redirigir, en un ciclo sin fin. El logo vuelve al panel, como en
 * la cabecera de NexoSidebar. Nunca muestra el código del permiso.
 */
export default async function SinAccesoPage() {
  const [panelUrl, { logoUrl }] = await Promise.all([getPanelUrl(), getPlatformSettings()]);

  return (
    <main className="flex min-h-full flex-1 items-center justify-center bg-neutral-100 px-4 py-16">
      <div className="flex w-full max-w-md flex-col items-center gap-6">
        <h1 className="sr-only">Sin acceso a Presupuesto</h1>
        <BackToPanelLink href={panelUrl} logoUrl={logoUrl} />
        <EmptyState
          variant="no-access"
          className="w-full"
          title="No tienes acceso a Presupuesto"
          description="Tu cuenta no tiene la aplicación Presupuesto en esta empresa. Si la necesitas, pide a un administrador que la agregue a tu rol."
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
