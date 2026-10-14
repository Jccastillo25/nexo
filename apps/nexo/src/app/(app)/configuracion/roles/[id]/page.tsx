import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { hasPermission } from "@nexo/permissions";
import { EmptyState, PageHeader } from "@nexo/ui";
import { createClient } from "@/lib/supabase/server";
import { getCompanyId } from "@/lib/company";
import { agruparCatalogo } from "@/lib/permisos-catalogo";
import RolForm from "../rol-form";

export const metadata: Metadata = {
  title: "Editar rol · Nexo",
};

export default async function EditarRolPage({ params }: PageProps<"/configuracion/roles/[id]">) {
  const { id } = await params;
  const supabase = await createClient();
  const companyId = getCompanyId();

  const canEdit = await hasPermission({ supabase, companyId }, "nexo.administracion.roles.editar");
  if (!canEdit) {
    return (
      <div className="flex max-w-4xl flex-col gap-6">
        <PageHeader title="Editar rol" />
        <EmptyState
          title="Sin permiso para editar roles"
          description="Tu cuenta no tiene el permiso nexo.administracion.roles.editar para esta empresa."
        />
      </div>
    );
  }

  const [{ data: roles, error }, { data: catalogo }, { data: plantillas }] = await Promise.all([
    supabase.rpc("admin_listar_roles", { p_company_id: companyId }),
    supabase.rpc("admin_catalogo_permisos", { p_company_id: companyId }),
    supabase.rpc("admin_plantillas_rol", { p_company_id: companyId }),
  ]);

  if (error) {
    return (
      <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
        No se pudo cargar el rol: {error.message}
      </p>
    );
  }

  const rol = (roles ?? []).find((r) => r.id === id);
  if (!rol) notFound();

  return (
    <div className="flex max-w-4xl flex-col gap-6">
      <PageHeader
        title={`Editar rol: ${rol.nombre}`}
        description={
          rol.usuarios > 0
            ? `${rol.usuarios} ${rol.usuarios === 1 ? "usuario tiene" : "usuarios tienen"} este rol — los cambios les aplican de inmediato.`
            : "Ningún usuario tiene este rol todavía."
        }
      />
      <RolForm
        apps={agruparCatalogo(catalogo ?? [])}
        plantillas={plantillas ?? []}
        inicial={{ id: rol.id, nombre: rol.nombre, descripcion: rol.descripcion, permisos: rol.permisos }}
      />
    </div>
  );
}
