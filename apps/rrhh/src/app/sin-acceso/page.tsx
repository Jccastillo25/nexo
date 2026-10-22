import type { Metadata } from "next";
import { BackToPanelLink, SubmitButton } from "@nexo/ui";
import { getPanelUrl, getPlatformSettings, signOut } from "@nexo/auth";

export const metadata: Metadata = {
  title: "Sin acceso",
};

/**
 * Se muestra cuando hay sesion valida pero sin el permiso de visibilidad de
 * la app para la empresa actual: `rrhh.ver_modulo` (guard de
 * app/(app)/layout.tsx) o `asistencia.ver_modulo` (guard de
 * app/(asistencia)/asistencia/layout.tsx, 2026-10-17). Por eso el texto es
 * generico y no imprime codigos de permiso. Vive fuera de ambos route
 * groups a proposito: si estuviera adentro, el mismo guard que redirige
 * para aca volveria a redirigir, en loop infinito.
 *
 * Nexo Enterprise UI (2026-09-07): tema claro. Reconciliacion de navegacion
 * (2026-09-14): el logo vuelve al panel (BackToPanelLink).
 * Kernel (2026-10-20): marca (sin cookies, en caché), URL del panel y cierre
 * de sesión salen de @nexo/auth.
 */
export default async function SinAccesoPage() {
  const [panelUrl, { logoUrl }] = await Promise.all([getPanelUrl(), getPlatformSettings()]);

  return (
    <div className="flex min-h-screen flex-1 items-center justify-center bg-[var(--nexo-enterprise-bg)] px-4 py-16">
      <div className="w-full max-w-sm rounded-xl border border-neutral-200 bg-white p-8 text-center shadow-sm">
        <p className="text-xs uppercase tracking-[0.2em] text-neutral-500">Materiales J Castillo</p>
        <h1 className="mt-2 text-2xl font-semibold text-neutral-900">Sin acceso</h1>
        <p className="mt-4 text-sm text-neutral-500">
          Tu cuenta no tiene acceso a esta aplicación en esta empresa. Si
          crees que es un error, pide a un administrador que te la asigne.
        </p>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-4">
          <BackToPanelLink href={panelUrl} logoUrl={logoUrl} />
          <form action={signOut}>
            <SubmitButton variant="secondary" size="sm" pendingLabel="Cerrando sesión…">
              Cerrar sesión
            </SubmitButton>
          </form>
        </div>
      </div>
    </div>
  );
}
