import { redirect } from "next/navigation";
import { NexoShell } from "@nexo/ui";
import { getPanelUrl, sesionActual, signOut } from "@nexo/auth";
import type { Database } from "@/lib/supabase/database.types";
import { permisosDe } from "@/lib/permisos-rrhh";
import { rrhhNav } from "@/lib/nav";

/**
 * Guard de modulo (norma v3.0): el proxy solo verifica que haya sesion —
 * eso es AUTENTICACION, no AUTORIZACION. Sin este chequeo, cualquier
 * usuario autenticado en el Supabase compartido de nexo-core podria ver el
 * shell de RRHH con solo escribir la URL. `rrhh.ver_modulo` es el permiso
 * que el trigger `trg_seed_module_permission` creo al registrar 'rrhh' en
 * core.apps — aca es donde se hace cumplir.
 *
 * Nexo Enterprise UI (2026-09-07): NexoShell arma el sidebar azul
 * persistente + topbar con breadcrumb automatico a partir de rrhhNav(permisos).
 *
 * Kernel (2026-10-20): sesionActual() hace UNA llamada a auth.getUser() por
 * request y permisosDe() UNA consulta de permisos; las dos quedan en caché
 * del request, así la página las reutiliza sin repetirlas.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const [permisos, { user }, panelUrl] = await Promise.all([
    permisosDe(),
    sesionActual<Database>(),
    getPanelUrl(),
  ]);

  if (!permisos.modulo) {
    redirect("/sin-acceso");
  }

  return (
    <NexoShell
      moduleLabel="RRHH"
      moduleHref="/dashboard"
      items={rrhhNav(permisos)}
      userEmail={user?.email}
      onSignOut={signOut}
      backHref={panelUrl}
    >
      {children}
    </NexoShell>
  );
}
