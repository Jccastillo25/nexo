import { redirect } from "next/navigation";
import { NexoShell } from "@nexo/ui";
import { getPanelUrl, getPlatformSettings, sesionActual, signOut } from "@nexo/auth";
import { presupuestoNav } from "@/lib/nav";
import { permisosDe } from "@/lib/metas/permisos";

/**
 * Guard de módulo (norma v3.0): el proxy solo verifica que haya sesión, eso
 * es AUTENTICACIÓN, no AUTORIZACIÓN. Sin este chequeo, cualquier usuario
 * autenticado en nexo-core (incluso de otra empresa, o sin la app habilitada)
 * vería el shell con solo escribir la URL. `presupuesto.ver_modulo` lo creó el
 * trigger trg_seed_module_permission al registrar la app en core.apps; aquí
 * se hace cumplir.
 *
 * Todo en paralelo y en caché del request: la página reutiliza el mismo
 * cliente y la misma lectura de permisos, sin otra llamada a Auth ni otra RPC.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const [permisos, { user }, panelUrl, ajustes] = await Promise.all([
    permisosDe(),
    sesionActual(),
    getPanelUrl(),
    getPlatformSettings(),
  ]);

  if (!permisos.modulo) redirect("/sin-acceso");

  return (
    <NexoShell
      moduleLabel="Presupuesto"
      moduleHref="/dashboard"
      items={presupuestoNav(permisos)}
      userEmail={user?.email}
      onSignOut={signOut}
      backHref={panelUrl}
      footerText={ajustes.copyrightText}
    >
      {children}
    </NexoShell>
  );
}
