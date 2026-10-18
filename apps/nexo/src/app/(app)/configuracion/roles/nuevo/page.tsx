import type { Metadata } from "next";
import { hasPermission } from "@nexo/permissions";
import { EmptyState, PageHeader } from "@nexo/ui";
import { createClient } from "@/lib/supabase/server";
import { getCompanyId } from "@/lib/company";
import { mensajeAdministracion } from "../../errores";
import { agruparCatalogo } from "@/lib/permisos-catalogo";
import RolForm from "../rol-form";

export const metadata: Metadata = {
  title: "Nuevo rol · Nexo",
};

export default async function NuevoRolPage() {
  const supabase = await createClient();
  const companyId = getCompanyId();

  const canCreate = await hasPermission({ supabase, companyId }, "nexo.administracion.roles.crear");
  if (!canCreate) {
    return (
      <div className="flex max-w-4xl flex-col gap-6">
        <PageHeader title="Nuevo rol" />
        <EmptyState
          title="Sin permiso para crear roles"
          description="Tu cuenta no tiene el permiso nexo.administracion.roles.crear para esta empresa."
        />
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
        <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {mensajeAdministracion(error, "roles/nuevo: catálogo de permisos", "No se pudo cargar el catálogo de permisos. Intenta de nuevo.")}
        </p>
      ) : (
        <RolForm apps={agruparCatalogo(catalogo ?? [])} plantillas={plantillas ?? []} inicial={null} />
      )}
    </div>
  );
}
