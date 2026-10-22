import type { Metadata } from "next";
import { Alert, DataTable, EmptyState, PageHeader, fechaHora } from "@nexo/ui";
import { contextoActual } from "@nexo/auth";
import { permisosDe } from "@/lib/permisos";
import { mensajeAdministracion } from "../errores";
import type { Database, EventoAuditoria, Json } from "@/lib/supabase/database.types";

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
  const [{ supabase, companyId }, permisos] = await Promise.all([contextoActual<Database>(), permisosDe()]);

  if (!permisos.auditoriaVer) {
    return (
      <div className="flex max-w-5xl flex-col gap-6">
        <PageHeader title="Auditoría" />
        <EmptyState variant="no-access" title="No tienes acceso a la auditoría" />
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
      <DataTable<EventoAuditoria>
        rows={eventos ?? []}
        rowKey={(e) => e.id}
        caption="Historial de cambios"
        emptyLabel="Todavía no hay cambios registrados."
        error={
          error ? (
            <Alert tone="error">
              {mensajeAdministracion(error, "auditoria: admin_listar_auditoria", "No se pudo cargar la auditoría. Intenta de nuevo.")}
            </Alert>
          ) : undefined
        }
        columns={[
          {
            key: "fecha",
            header: "Fecha",
            className: "whitespace-nowrap tabular-nums",
            render: (e) => fechaHora(e.creado_en),
          },
          { key: "actor", header: "Quién", render: (e) => e.actor_email ?? "—" },
          { key: "accion", header: "Acción", render: (e) => ACCIONES[e.accion] ?? e.accion },
          { key: "detalle", header: "Detalle", render: (e) => resumen(e.detalle) || "—" },
        ]}
      />
    </div>
  );
}
