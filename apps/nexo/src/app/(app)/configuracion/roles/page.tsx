import Link from "next/link";
import type { Metadata } from "next";
import { hasPermission } from "@nexo/permissions";
import { DataTable, EmptyState, PageHeader, StatusBadge } from "@nexo/ui";
import { createClient } from "@/lib/supabase/server";
import { getCompanyId } from "@/lib/company";
import { appsDelRol } from "@/lib/permisos-catalogo";
import type { AdminRol } from "@/lib/supabase/database.types";
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
  const supabase = await createClient();
  const companyId = getCompanyId();
  const ctx = { supabase, companyId };

  const [canView, canCreate, canEdit, canDelete] = await Promise.all([
    hasPermission(ctx, "nexo.administracion.roles.ver"),
    hasPermission(ctx, "nexo.administracion.roles.crear"),
    hasPermission(ctx, "nexo.administracion.roles.editar"),
    hasPermission(ctx, "nexo.administracion.roles.eliminar"),
  ]);

  if (!canView) {
    return (
      <div className="flex max-w-5xl flex-col gap-6">
        <PageHeader title="Roles" />
        <EmptyState
          title="Sin permiso para ver roles"
          description="Tu cuenta no tiene el permiso nexo.administracion.roles.ver para esta empresa."
        />
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
        actions={
          canCreate ? (
            <Link
              href="/configuracion/roles/nuevo"
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
            >
              Nuevo rol
            </Link>
          ) : undefined
        }
      />

      {error && (
        <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          No se pudieron cargar los roles: {error.message}
        </p>
      )}

      {!error && (roles ?? []).length === 0 ? (
        <EmptyState
          title="Todavía no hay roles"
          description="Creá el primer rol para poder asignarlo a los usuarios."
        />
      ) : (
        <DataTable<AdminRol>
          rows={roles ?? []}
          rowKey={(r) => r.id}
          columns={[
            {
              key: "nombre",
              header: "Rol",
              render: (r) =>
                canEdit ? (
                  <Link href={`/configuracion/roles/${r.id}`} className="font-medium text-blue-700 hover:underline">
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
            { key: "permisos", header: "Permisos", render: (r) => r.permisos.length },
            { key: "usuarios", header: "Usuarios", render: (r) => r.usuarios },
            {
              key: "estado",
              header: "Estado",
              render: (r) => <StatusBadge label={r.activo ? "Activo" : "Inactivo"} tone={r.activo ? "positive" : "neutral"} />,
            },
            {
              key: "acciones",
              header: "",
              align: "right",
              render: (r) =>
                canDelete ? <EliminarRolButton rolId={r.id} nombre={r.nombre} enUso={r.usuarios > 0} /> : null,
            },
          ]}
        />
      )}
    </div>
  );
}
