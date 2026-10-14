import type { Metadata } from "next";
import { hasPermission } from "@nexo/permissions";
import { DataTable, EmptyState, PageHeader } from "@nexo/ui";
import { createClient } from "@/lib/supabase/server";
import { getCompanyId } from "@/lib/company";
import type { EventoAuditoria, Json } from "@/lib/supabase/database.types";

export const metadata: Metadata = {
  title: "Auditoría · Nexo",
};

const ACCIONES: Record<string, string> = {
  "admin.rol.crear": "Creó un rol",
  "admin.rol.editar": "Editó un rol",
  "admin.rol.eliminar": "Eliminó un rol",
  "admin.usuario.crear": "Creó un usuario",
  "admin.usuario.editar": "Editó un usuario",
  "admin.usuario.desactivar": "Desactivó un usuario",
  "admin.usuario.reactivar": "Reactivó un usuario",
  "admin.usuario.password_restablecida": "Restableció una contraseña",
  "admin.usuario.sucursales": "Cambió las sucursales de un usuario",
  "admin.sucursal.crear": "Creó una sucursal",
  "admin.sucursal.editar": "Editó una sucursal",
  "admin.atencion.puesto.crear": "Creó un puesto de atención",
  "admin.atencion.puesto.editar": "Editó un puesto de atención",
  "admin.atencion.pantalla.crear": "Creó una pantalla",
  "admin.atencion.pantalla.editar": "Editó una pantalla",
  "admin.atencion.sesion.liberar": "Liberó un puesto",
};

function resumen(detalle: Json): string {
  if (!detalle || typeof detalle !== "object" || Array.isArray(detalle)) return "";
  const partes: string[] = [];
  if (typeof detalle.nombre === "string") partes.push(detalle.nombre);
  const agregados = Array.isArray(detalle.agregados) ? detalle.agregados.length : 0;
  const quitados = Array.isArray(detalle.quitados) ? detalle.quitados.length : 0;
  if (agregados) partes.push(`+${agregados} permisos`);
  if (quitados) partes.push(`−${quitados} permisos`);
  if (detalle.rol_antes !== undefined && detalle.rol_antes !== detalle.rol_despues) partes.push("cambió de rol");
  if (detalle.empleado_antes !== detalle.empleado_despues && detalle.empleado_despues !== undefined) {
    partes.push(detalle.empleado_despues ? "vinculó empleado" : "desvinculó empleado");
  }
  return partes.join(" · ");
}

/** Últimos 200 cambios de usuarios y roles (acciones admin.* de core.audit_log). */
export default async function AuditoriaPage() {
  const supabase = await createClient();
  const companyId = getCompanyId();

  const canView = await hasPermission({ supabase, companyId }, "nexo.administracion.auditoria.ver");
  if (!canView) {
    return (
      <div className="flex max-w-5xl flex-col gap-6">
        <PageHeader title="Auditoría" />
        <EmptyState
          title="Sin permiso para ver la auditoría"
          description="Tu cuenta no tiene el permiso nexo.administracion.auditoria.ver para esta empresa."
        />
      </div>
    );
  }

  const { data: eventos, error } = await supabase.rpc("admin_listar_auditoria", {
    p_company_id: companyId,
    p_limite: 200,
  });

  return (
    <div className="flex max-w-6xl flex-col gap-6">
      <PageHeader title="Auditoría" description="Historial de cambios en usuarios y roles: quién hizo qué y cuándo." />
      {error && (
        <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          No se pudo cargar la auditoría: {error.message}
        </p>
      )}
      <DataTable<EventoAuditoria>
        rows={eventos ?? []}
        rowKey={(e) => e.id}
        emptyLabel="Todavía no hay cambios registrados."
        columns={[
          {
            key: "fecha",
            header: "Fecha",
            render: (e) =>
              new Date(e.creado_en).toLocaleString("es-NI", {
                day: "2-digit",
                month: "short",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              }),
          },
          { key: "actor", header: "Quién", render: (e) => e.actor_email ?? "—" },
          { key: "accion", header: "Acción", render: (e) => ACCIONES[e.accion] ?? e.accion },
          { key: "detalle", header: "Detalle", render: (e) => resumen(e.detalle) || "—" },
        ]}
      />
    </div>
  );
}
