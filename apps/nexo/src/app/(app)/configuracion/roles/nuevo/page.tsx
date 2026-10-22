import type { Metadata } from "next";
import { Alert, EmptyState, PageHeader } from "@nexo/ui";
import { contextoActual } from "@nexo/auth";
import { permisosDe } from "@/lib/permisos";
import type { Database } from "@/lib/supabase/database.types";
import { mensajeAdministracion } from "../../errores";
import { agruparCatalogo } from "@/lib/permisos-catalogo";
import RolForm from "../rol-form";

export const metadata: Metadata = {
  title: "Nuevo rol · Nexo",
};

export default async function NuevoRolPage() {
  const [{ supabase, companyId }, permisos] = await Promise.all([contextoActual<Database>(), permisosDe()]);

  if (!permisos.rolesCrear) {
    return (
      <div className="flex max-w-4xl flex-col gap-6">
        <PageHeader title="Nuevo rol" />
        <EmptyState variant="no-access" title="No tienes acceso a la creación de roles" />
      </div>
    );
  }

  const [{ data: catalogo, error }, { data: plantillas }] = await Promise.all([
    supabase.rpc("admin_catalogo_permisos", { p_company_id: companyId }),
    supabase.rpc("admin_plantillas_rol", { p_company_id: companyId }),
  ]);

  return (
    <div className="flex max-w-4xl flex-col gap-6">
      <PageHeader title="Nuevo rol" description="Nombre, aplicaciones con acceso y permisos internos de cada una." />
      {error ? (
        <Alert tone="error">
          {mensajeAdministracion(error, "roles/nuevo: catálogo de permisos", "No se pudo cargar el catálogo de permisos. Intenta de nuevo.")}
        </Alert>
      ) : (
        <RolForm apps={agruparCatalogo(catalogo ?? [])} plantillas={plantillas ?? []} inicial={null} />
      )}
    </div>
  );
}
