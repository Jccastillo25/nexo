import type { Metadata } from "next";
import { hasPermission } from "@nexo/permissions";
import { EmptyState, PageHeader } from "@nexo/ui";
import { createClient } from "@/lib/supabase/server";
import { getCompanyId } from "@/lib/company";
import UsuarioForm from "../usuario-form";

export const metadata: Metadata = {
  title: "Nuevo usuario · Nexo",
};

export default async function NuevoUsuarioPage() {
  const supabase = await createClient();
  const companyId = getCompanyId();

  const canCreate = await hasPermission({ supabase, companyId }, "nexo.administracion.usuarios.crear");
  if (!canCreate) {
    return (
      <div className="flex max-w-3xl flex-col gap-6">
        <PageHeader title="Nuevo usuario" />
        <EmptyState
          title="Sin permiso para crear usuarios"
          description="Tu cuenta no tiene el permiso nexo.administracion.usuarios.crear para esta empresa."
        />
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
      <PageHeader title="Nuevo usuario" description="La contraseña la ponés vos; el usuario la cambia en su primer ingreso." />
      <UsuarioForm
        roles={(roles ?? []).filter((r) => r.activo).map((r) => ({ id: r.id, nombre: r.nombre }))}
        sucursales={sucError ? null : (sucursales ?? []).filter((s) => s.activa).map((s) => ({ id: s.id, nombre: s.nombre }))}
        sucursalesAsignadas={[]}
        usuario={null}
      />
    </div>
  );
}
