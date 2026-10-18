import Link from "next/link";
import type { Metadata } from "next";
import { hasPermission } from "@nexo/permissions";
import { DataTable, EmptyState, PageHeader, StatusBadge } from "@nexo/ui";
import { createClient } from "@/lib/supabase/server";
import { getCompanyId } from "@/lib/company";
import { mensajeAdministracion } from "../errores";
import type { AdminUsuario } from "@/lib/supabase/database.types";

export const metadata: Metadata = {
  title: "Usuarios · Nexo",
};

function fecha(iso: string | null): string {
  if (!iso) return "Nunca";
  return new Date(iso).toLocaleDateString("es-NI", { day: "2-digit", month: "short", year: "numeric" });
}

/**
 * Usuarios de la empresa (docs/plan/12-administracion-usuarios-roles.md).
 * Lectura vía public.admin_listar_usuarios (exige
 * nexo.administracion.usuarios.ver); acciones solo visibles con su permiso.
 */
export default async function UsuariosPage() {
  const supabase = await createClient();
  const companyId = getCompanyId();
  const ctx = { supabase, companyId };

  const [canView, canCreate, canEdit] = await Promise.all([
    hasPermission(ctx, "nexo.administracion.usuarios.ver"),
    hasPermission(ctx, "nexo.administracion.usuarios.crear"),
    hasPermission(ctx, "nexo.administracion.usuarios.editar"),
  ]);

  if (!canView) {
    return (
      <div className="flex max-w-5xl flex-col gap-6">
        <PageHeader title="Usuarios" />
        <EmptyState
          title="Sin permiso para ver usuarios"
          description="Tu cuenta no tiene el permiso nexo.administracion.usuarios.ver para esta empresa."
        />
      </div>
    );
  }

  const { data: usuarios, error } = await supabase.rpc("admin_listar_usuarios", { p_company_id: companyId });

  return (
    <div className="flex max-w-6xl flex-col gap-6">
      <PageHeader
        title="Usuarios"
        description="Cuentas con acceso a Nexo. Cada usuario tiene un rol, que define a qué aplicaciones entra y qué puede hacer."
        actions={
          canCreate ? (
            <Link
              href="/configuracion/usuarios/nuevo"
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
            >
              Nuevo usuario
            </Link>
          ) : undefined
        }
      />

      {error && (
        <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {mensajeAdministracion(error, "usuarios: admin_listar_usuarios", "No se pudieron cargar los usuarios. Intenta de nuevo.")}
        </p>
      )}

      <DataTable<AdminUsuario>
        rows={usuarios ?? []}
        rowKey={(u) => u.user_id}
        emptyLabel="Todavía no hay usuarios."
        columns={[
          {
            key: "nombre",
            header: "Nombre",
            render: (u) => {
              const nombre = u.nombre_completo ?? u.email;
              return canEdit ? (
                <Link href={`/configuracion/usuarios/${u.user_id}`} className="font-medium text-blue-700 hover:underline">
                  {nombre}
                </Link>
              ) : (
                <span className="font-medium text-neutral-900">{nombre}</span>
              );
            },
          },
          { key: "email", header: "Correo", render: (u) => u.email },
          {
            key: "rol",
            header: "Rol",
            render: (u) => (u.es_owner ? <StatusBadge label="Owner" tone="info" /> : u.rol_nombre ?? "Sin rol"),
          },
          { key: "empleado", header: "Empleado RRHH", render: (u) => u.empleado_nombre ?? "—" },
          {
            key: "estado",
            header: "Estado",
            render: (u) => (
              <div className="flex flex-wrap gap-1">
                <StatusBadge label={u.activo ? "Activo" : "Inactivo"} tone={u.activo ? "positive" : "negative"} />
                {u.debe_cambiar_password && <StatusBadge label="Contraseña temporal" tone="warning" />}
              </div>
            ),
          },
          { key: "ingreso", header: "Último ingreso", render: (u) => fecha(u.ultimo_ingreso) },
        ]}
      />
    </div>
  );
}
