import type { Metadata } from "next";
import { EmptyState, PageHeader } from "@nexo/ui";
import { getPlatformSettings } from "@nexo/auth";
import { permisosDe } from "@/lib/permisos";
import MarcaForm from "./marca-form";

export const metadata: Metadata = {
  title: "Configuración de marca · Nexo",
};

/**
 * Editor de core.platform_settings (logo, imagen de fondo del login,
 * favicon, textos, bullets, copyright de toda la plataforma) — pedido
 * explicito del usuario: "el login tiene que ser completamente editable".
 * Guardado por permiso "nexo.configuracion.editar" (norma v3.0) — ver
 * supabase/migrations/20260830000011_platform_settings.sql y
 * 20260907223910_nexo_enterprise_ui_favicon.sql.
 *
 * Nexo Enterprise UI (2026-09-07): reubicada de /ajustes a
 * /configuracion/marca (Nexo → Configuración → Marca, §1.9) — misma
 * lógica de negocio, ahora dentro del layout autenticado con NexoShell.
 * /ajustes queda como redirect por compatibilidad.
 *
 * Kernel (2026-10-20): la marca sale de getPlatformSettings (@nexo/auth),
 * los mismos campos que lee el login.
 */
export default async function ConfiguracionMarcaPage() {
  const [permisos, settings] = await Promise.all([permisosDe(), getPlatformSettings()]);

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <PageHeader
        title="Marca"
        description="Logo, imagen de fondo, favicon, textos y bullets del login, y el copyright que se muestra en toda la plataforma."
      />

      {permisos.marcaEditar ? (
        <MarcaForm initial={settings} />
      ) : (
        <EmptyState variant="no-access" title="No tienes acceso a la configuración de marca" />
      )}
    </div>
  );
}
