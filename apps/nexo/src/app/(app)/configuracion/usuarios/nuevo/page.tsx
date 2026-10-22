import type { Metadata } from "next";
import { EmptyState, PageHeader } from "@nexo/ui";
import { contextoActual } from "@nexo/auth";
import { permisosDe } from "@/lib/permisos";
import type { Database } from "@/lib/supabase/database.types";
import UsuarioForm from "../usuario-form";

export const metadata: Metadata = {
  title: "Nuevo usuario · Nexo",
};

export default async function NuevoUsuarioPage() {
  const [{ supabase, companyId }, permisos] = await Promise.all([contextoActual<Database>(), permisosDe()]);

  if (!permisos.usuariosCrear) {
    return (
      <div className="flex max-w-3xl flex-col gap-6">
        <PageHeader title="Nuevo usuario" />
        <EmptyState variant="no-access" title="No tienes acceso a la creación de usuarios" />
      </div>
    );
  }

  // Exige además nexo.administracion.roles.ver; sin él la lista llega vacía
  // y el formulario lo explica.
  const [{ data: roles }, { data: sucursales, error: sucError }] = await Promise.all([
    supabase.rpc("admin_listar_roles", { p_company_id: companyId }),
    supabase.rpc("admin_listar_sucursales", { p_company_id: companyId }),
  ]);

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <PageHeader
        title="Nuevo usuario"
        description="Tú pones la contraseña temporal; el usuario la cambia en su primer ingreso."
      />
      <UsuarioForm
        roles={(roles ?? []).filter((r) => r.activo).map((r) => ({ id: r.id, nombre: r.nombre }))}
        sucursales={sucError ? null : (sucursales ?? []).filter((s) => s.activa).map((s) => ({ id: s.id, nombre: s.nombre }))}
        sucursalesAsignadas={[]}
        usuario={null}
      />
    </div>
  );
}
