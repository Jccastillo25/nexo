import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Alert, EmptyState, PageHeader } from "@nexo/ui";
import { contextoActual } from "@nexo/auth";
import { permisosDe } from "@/lib/permisos";
import type { Database } from "@/lib/supabase/database.types";
import { mensajeAdministracion } from "../../errores";
import { agruparCatalogo } from "@/lib/permisos-catalogo";
import RolForm from "../rol-form";

export const metadata: Metadata = {
  title: "Editar rol · Nexo",
};

export default async function EditarRolPage({ params }: PageProps<"/configuracion/roles/[id]">) {
  const [{ id }, { supabase, companyId }, permisos] = await Promise.all([
    params,
    contextoActual<Database>(),
    permisosDe(),
  ]);

  if (!permisos.rolesEditar) {
    return (
      <div className="flex max-w-4xl flex-col gap-6">
        <PageHeader title="Editar rol" />
        <EmptyState variant="no-access" title="No tienes acceso a la edición de roles" />
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
      <div className="flex max-w-4xl flex-col gap-6">
        <PageHeader title="Editar rol" />
        <Alert tone="error">
          {mensajeAdministracion(error, "roles/[id]: carga del rol", "No se pudo cargar el rol. Intenta de nuevo.")}
        </Alert>
      </div>
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
