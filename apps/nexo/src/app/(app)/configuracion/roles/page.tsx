import Link from "next/link";
import type { Metadata } from "next";
import { Alert, ButtonLink, DataTable, EmptyState, PageHeader, StatusBadge } from "@nexo/ui";
import { contextoActual } from "@nexo/auth";
import { permisosDe } from "@/lib/permisos";
import { mensajeAdministracion } from "../errores";
import { appsDelRol } from "@/lib/permisos-catalogo";
import type { AdminRol, Database } from "@/lib/supabase/database.types";
import EliminarRolButton from "./eliminar-rol-button";

export const metadata: Metadata = {
  title: "Roles · Nexo",
};

/**
 * Roles de empresa (docs/plan/12-administracion-usuarios-roles.md): cada
 * rol = apps con acceso + permisos internos; cada usuario tiene uno solo.
 * Lectura vía public.admin_listar_roles (exige nexo.administracion.roles.ver).
 */
export default async function RolesPage() {
  const [{ supabase, companyId }, permisos] = await Promise.all([contextoActual<Database>(), permisosDe()]);

  if (!permisos.rolesVer) {
    return (
      <div className="flex max-w-5xl flex-col gap-6">
        <PageHeader title="Roles" />
        <EmptyState variant="no-access" title="No tienes acceso a los roles" />
      </div>
    );
  }

  const [{ data: roles, error }, { data: catalogo }] = await Promise.all([
    supabase.rpc("admin_listar_roles", { p_company_id: companyId }),
    supabase.rpc("admin_catalogo_permisos", { p_company_id: companyId }),
  ]);

  return (
    <div className="flex max-w-5xl flex-col gap-6">
      <PageHeader
        title="Roles"
        description="Cada rol define a qué aplicaciones tiene acceso un usuario y qué puede hacer dentro de ellas. Cada usuario tiene un solo rol."
        actions={permisos.rolesCrear ? <ButtonLink href="/configuracion/roles/nuevo">Nuevo rol</ButtonLink> : undefined}
      />

      <DataTable<AdminRol>
        rows={roles ?? []}
        rowKey={(r) => r.id}
        caption="Roles"
        error={
          error ? (
            <Alert tone="error">
              {mensajeAdministracion(error, "roles: admin_listar_roles", "No se pudieron cargar los roles. Intenta de nuevo.")}
            </Alert>
          ) : undefined
        }
        empty={
          <EmptyState
            bare
            title="Todavía no hay roles"
            description="Crea el primer rol para poder asignarlo a los usuarios."
          />
        }
        columns={[
          {
            key: "nombre",
            header: "Rol",
            render: (r) =>
              permisos.rolesEditar ? (
                <Link
                  href={`/configuracion/roles/${r.id}`}
                  className="rounded-sm font-medium text-blue-700 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                >
                  {r.nombre}
                </Link>
              ) : (
                <span className="font-medium text-neutral-900">{r.nombre}</span>
              ),
          },
          {
            key: "apps",
            header: "Aplicaciones",
            render: (r) => appsDelRol(r.permisos, catalogo ?? []).join(", ") || "—",
          },
          { key: "permisos", header: "Permisos", numeric: true, render: (r) => r.permisos.length },
          { key: "usuarios", header: "Usuarios", numeric: true, render: (r) => r.usuarios },
          {
            key: "estado",
            header: "Estado",
            render: (r) => <StatusBadge label={r.activo ? "Activo" : "Inactivo"} tone={r.activo ? "positive" : "neutral"} />,
          },
          {
            key: "acciones",
            header: <span className="sr-only">Acciones</span>,
            align: "right",
            render: (r) =>
              permisos.rolesEliminar ? <EliminarRolButton rolId={r.id} nombre={r.nombre} enUso={r.usuarios > 0} /> : null,
          },
        ]}
      />
    </div>
  );
}
