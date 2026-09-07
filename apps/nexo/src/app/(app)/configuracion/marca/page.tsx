import type { Metadata } from "next";
import { hasPermission } from "@nexo/permissions";
import { EmptyState, PageHeader } from "@nexo/ui";
import { createClient } from "@/lib/supabase/server";
import { getCompanyId } from "@/lib/company";
import { getPlatformSettings } from "@/lib/platform-settings";
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
 */
export default async function ConfiguracionMarcaPage() {
  const supabase = await createClient();
  const companyId = getCompanyId();

  const [canEdit, settings] = await Promise.all([
    hasPermission({ supabase, companyId }, "nexo.configuracion.editar"),
    getPlatformSettings(supabase),
  ]);

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <PageHeader
        title="Marca"
        description="Logo, imagen de fondo, favicon, textos y bullets del login, y el copyright que se muestra en toda la plataforma."
      />

      {canEdit ? (
        <MarcaForm initial={settings} />
      ) : (
        <EmptyState
          title="Sin permiso para editar la marca"
          description="Tu cuenta no tiene el permiso nexo.configuracion.editar para esta empresa."
        />
      )}
    </div>
  );
}
