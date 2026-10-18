import { redirect } from "next/navigation";
import { NexoShell } from "@nexo/ui";
import { createClient } from "@/lib/supabase/server";
import { getCompanyId } from "@/lib/company";
import { getPanelUrl } from "@/lib/panel";
import { permisosAsistenciaDe } from "@/lib/permisos-asistencia";
import { asistenciaNav } from "@/lib/asistencia-nav";
import { signOut } from "@/app/(app)/actions";

/**
 * App Asistencia (2026-10-17): mismo deploy que RRHH (basePath /rrhh), pero
 * en un route group HERMANO de (app), no anidado, para no heredar el guard
 * `rrhh.ver_modulo` ni el menú de RRHH. El proxy solo autentica; este
 * layout autoriza la app con `asistencia.ver_modulo` (permiso de
 * visibilidad creado por trg_seed_module_permission al registrar el slug
 * en core.apps). Mismo patrón que apps/productos/src/app/(app)/layout.tsx.
 */
export default async function AsistenciaLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const companyId = getCompanyId();

  const [permisos, panelUrl, { data: { user } }] = await Promise.all([
    permisosAsistenciaDe(companyId),
    getPanelUrl(),
    supabase.auth.getUser(),
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
    >
      {children}
    </NexoShell>
  );
}
