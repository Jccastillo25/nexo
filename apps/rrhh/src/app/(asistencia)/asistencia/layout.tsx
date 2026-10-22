import { redirect } from "next/navigation";
import { NexoShell } from "@nexo/ui";
import { getPanelUrl, getPlatformSettings, sesionActual, signOut } from "@nexo/auth";
import { permisosAsistencia } from "@/lib/permisos-asistencia";
import { asistenciaNav } from "@/lib/asistencia-nav";

/**
 * App Asistencia (2026-10-17): mismo deploy que RRHH (basePath /rrhh), pero
 * en un route group HERMANO de (app), no anidado, para no heredar el guard
 * `rrhh.ver_modulo` ni el menú de RRHH. El proxy solo autentica; este
 * layout autoriza la app con `asistencia.ver_modulo` (permiso de
 * visibilidad creado por trg_seed_module_permission al registrar el slug
 * en core.apps). Mismo patrón que apps/productos/src/app/(app)/layout.tsx.
 *
 * Kernel (2026-10-20): sesionActual y permisosAsistencia quedan en la caché
 * del request, así la página los reutiliza sin otra llamada a Auth ni otra
 * consulta de permisos.
 */
export default async function AsistenciaLayout({ children }: { children: React.ReactNode }) {
  const [permisos, { user }, panelUrl, ajustes] = await Promise.all([
    permisosAsistencia(),
    sesionActual(),
    getPanelUrl(),
    getPlatformSettings(),
  ]);

  if (!permisos.modulo) {
    redirect("/sin-acceso");
  }

  return (
    <NexoShell
      moduleLabel="Asistencia"
      moduleHref="/asistencia/dashboard"
      items={asistenciaNav(permisos)}
      userEmail={user?.email}
      onSignOut={signOut}
      backHref={panelUrl}
      footerText={ajustes.copyrightText}
    >
      {children}
    </NexoShell>
  );
}
