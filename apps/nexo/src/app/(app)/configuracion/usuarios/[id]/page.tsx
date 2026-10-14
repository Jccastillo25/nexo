import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { hasPermission } from "@nexo/permissions";
import { EmptyState, PageHeader, StatusBadge } from "@nexo/ui";
import { createClient } from "@/lib/supabase/server";
import { getCompanyId } from "@/lib/company";
import UsuarioForm from "../usuario-form";
import CuentaAcciones from "./cuenta-acciones";

export const metadata: Metadata = {
  title: "Editar usuario · Nexo",
};

export default async function EditarUsuarioPage({ params }: PageProps<"/configuracion/usuarios/[id]">) {
  const { id } = await params;
  const supabase = await createClient();
  const companyId = getCompanyId();
  const ctx = { supabase, companyId };

  const [canEdit, canToggle, { data: { user } }] = await Promise.all([
    hasPermission(ctx, "nexo.administracion.usuarios.editar"),
    hasPermission(ctx, "nexo.administracion.usuarios.desactivar"),
    supabase.auth.getUser(),
  ]);

  if (!canEdit) {
    return (
      <div className="flex max-w-3xl flex-col gap-6">
        <PageHeader title="Editar usuario" />
        <EmptyState
          title="Sin permiso para editar usuarios"
          description="Tu cuenta no tiene el permiso nexo.administracion.usuarios.editar para esta empresa."
        />
      </div>
    );
  }

  const [{ data: usuarios, error }, { data: roles }] = await Promise.all([
    supabase.rpc("admin_listar_usuarios", { p_company_id: companyId }),
    supabase.rpc("admin_listar_roles", { p_company_id: companyId }),
  ]);

  if (error) {
    return (
      <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
        No se pudo cargar el usuario: {error.message}
      </p>
    );
  }

  const u = (usuarios ?? []).find((x) => x.user_id === id);
  if (!u) notFound();
  const esUnoMismo = user?.id === u.user_id;

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <PageHeader
        title={u.nombre_completo ?? u.email}
        description={
          <span className="flex flex-wrap items-center gap-2">
            {u.email}
            <StatusBadge label={u.activo ? "Activo" : "Inactivo"} tone={u.activo ? "positive" : "negative"} />
            {u.es_owner && <StatusBadge label="Owner" tone="info" />}
            {u.debe_cambiar_password && <StatusBadge label="Contraseña temporal" tone="warning" />}
          </span>
        }
      />
      <UsuarioForm
        roles={(roles ?? [])
          .filter((r) => r.activo || r.id === u.rol_id)
          .map((r) => ({ id: r.id, nombre: r.nombre }))}
        usuario={{
          userId: u.user_id,
          email: u.email,
          nombreCompleto: u.nombre_completo ?? "",
          telefono: u.telefono ?? "",
          cargo: u.cargo ?? "",
          rolId: u.rol_id,
          esOwner: u.es_owner,
          esUnoMismo,
          empleado: u.empleado_id ? { id: u.empleado_id, nombre: u.empleado_nombre ?? "Empleado vinculado" } : null,
        }}
      />
      {!u.es_owner && !esUnoMismo && (
        <CuentaAcciones userId={u.user_id} activo={u.activo} puedeCambiarEstado={canToggle} />
      )}
    </div>
  );
}
