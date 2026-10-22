import Link from "next/link";
import type { Metadata } from "next";
import { Alert, ButtonLink, DataTable, EmptyState, PageHeader, StatusBadge, fechaHora } from "@nexo/ui";
import { contextoActual } from "@nexo/auth";
import { permisosDe } from "@/lib/permisos";
import { mensajeAdministracion } from "../errores";
import type { AdminUsuario, Database } from "@/lib/supabase/database.types";

export const metadata: Metadata = {
  title: "Usuarios · Nexo",
};

/**
 * Usuarios de la empresa (docs/plan/12-administracion-usuarios-roles.md).
 * Lectura vía public.admin_listar_usuarios (exige
 * nexo.administracion.usuarios.ver); acciones solo visibles con su permiso.
 */
export default async function UsuariosPage() {
  const [{ supabase, companyId }, permisos] = await Promise.all([contextoActual<Database>(), permisosDe()]);

  if (!permisos.usuariosVer) {
    return (
      <div className="flex max-w-5xl flex-col gap-6">
        <PageHeader title="Usuarios" />
        <EmptyState variant="no-access" title="No tienes acceso a los usuarios" />
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
          permisos.usuariosCrear ? (
            <ButtonLink href="/configuracion/usuarios/nuevo">Nuevo usuario</ButtonLink>
          ) : undefined
        }
      />

      <DataTable<AdminUsuario>
        rows={usuarios ?? []}
        rowKey={(u) => u.user_id}
        caption="Usuarios"
        emptyLabel="Todavía no hay usuarios."
        error={
          error ? (
            <Alert tone="error">
              {mensajeAdministracion(error, "usuarios: admin_listar_usuarios", "No se pudieron cargar los usuarios. Intenta de nuevo.")}
            </Alert>
          ) : undefined
        }
        columns={[
          {
            key: "nombre",
            header: "Nombre",
            render: (u) => {
              const nombre = u.nombre_completo ?? u.email;
              return permisos.usuariosEditar ? (
                <Link
                  href={`/configuracion/usuarios/${u.user_id}`}
                  className="rounded-sm font-medium text-blue-700 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                >
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
            render: (u) => (u.es_owner ? <StatusBadge label="Propietario" tone="info" /> : u.rol_nombre ?? "Sin rol"),
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
          {
            key: "ingreso",
            header: "Último ingreso",
            className: "whitespace-nowrap tabular-nums",
            render: (u) => (u.ultimo_ingreso ? fechaHora(u.ultimo_ingreso) : "Nunca"),
          },
        ]}
      />
    </div>
  );
}
