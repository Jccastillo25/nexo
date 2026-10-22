import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Alert, EmptyState, PageHeader, StatusBadge } from "@nexo/ui";
import { sesionActual } from "@nexo/auth";
import { permisosDe } from "@/lib/permisos";
import type { Database } from "@/lib/supabase/database.types";
import { mensajeAdministracion } from "../../errores";
import UsuarioForm from "../usuario-form";
import CuentaAcciones from "./cuenta-acciones";

export const metadata: Metadata = {
  title: "Editar usuario · Nexo",
};

export default async function EditarUsuarioPage({ params }: PageProps<"/configuracion/usuarios/[id]">) {
  // sesionActual: el usuario hace falta para saber si es uno mismo. Es la misma
  // llamada a Auth (en caché del request) que ya hizo el layout.
  const [{ id }, { supabase, companyId, user }, permisos] = await Promise.all([
    params,
    sesionActual<Database>(),
    permisosDe(),
  ]);

  if (!permisos.usuariosEditar) {
    return (
      <div className="flex max-w-3xl flex-col gap-6">
        <PageHeader title="Editar usuario" />
        <EmptyState variant="no-access" title="No tienes acceso a la edición de usuarios" />
      </div>
    );
  }

  const [{ data: usuarios, error }, { data: roles }, { data: sucursales, error: sucError }, { data: asignadas }] =
    await Promise.all([
      supabase.rpc("admin_listar_usuarios", { p_company_id: companyId }),
      supabase.rpc("admin_listar_roles", { p_company_id: companyId }),
      supabase.rpc("admin_listar_sucursales", { p_company_id: companyId }),
      supabase.rpc("admin_sucursales_de_usuario", { p_company_id: companyId, p_user_id: id }),
    ]);
  const idsAsignadas = (asignadas ?? []).map((a) => a.sucursal_id);

  if (error) {
    return (
      <div className="flex max-w-3xl flex-col gap-6">
        <PageHeader title="Editar usuario" />
        <Alert tone="error">
          {mensajeAdministracion(error, "usuarios/[id]: admin_listar_usuarios", "No se pudo cargar el usuario. Intenta de nuevo.")}
        </Alert>
      </div>
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
            {u.es_owner && <StatusBadge label="Propietario" tone="info" />}
            {u.debe_cambiar_password && <StatusBadge label="Contraseña temporal" tone="warning" />}
          </span>
        }
      />
      <UsuarioForm
        roles={(roles ?? [])
          .filter((r) => r.activo || r.id === u.rol_id)
          .map((r) => ({ id: r.id, nombre: r.nombre }))}
        sucursales={
          sucError
            ? null
            : (sucursales ?? [])
                .filter((s) => s.activa || idsAsignadas.includes(s.id))
                .map((s) => ({ id: s.id, nombre: s.nombre }))
        }
        sucursalesAsignadas={idsAsignadas}
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
        <CuentaAcciones userId={u.user_id} activo={u.activo} puedeCambiarEstado={permisos.usuariosDesactivar} />
      )}
    </div>
  );
}
